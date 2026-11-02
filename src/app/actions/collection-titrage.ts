"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  DESCRIPTION_MAX,
  SCHEMA_TITRAGE,
  TAILLE_PAQUET_TITRAGE,
  TITRE_MAX,
  construirePromptTitrage,
  lireReponseTitrage,
  type PropositionTitrage,
} from "@/lib/collection/titrage";
import { telechargerImage } from "@/lib/collection/image";
import { nettoyerTexte } from "@/lib/documents/tri";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { createAdminClient } from "@/lib/supabase/admin";

// Titrage d'un élément de la collection par Gemini, en deux temps avec un
// aperçu entre les deux (même principe que le tri du vrac des documents) :
// `analyserElementCollection` (un élément, lecture seule, appelée une fois par
// élément pour afficher la progression et isoler les échecs), puis
// `appliquerTitrage` (écrit seulement les propositions validées).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Un paquet entier doit tenir dans les 60 s de `maxDuration` des pages de la
// collection : 6 s de téléchargement au plus, puis Gemini.
const GEMINI_TIMEOUT_MS = 45_000;
const LOT_MAX_APPLIQUE = 50;

// Discriminant `statut` et non `ok` : `runAction` prend toute réponse
// `{ ok: true, … }` pour son propre contrat `ActionResult` (voir
// documents-vrac.ts).
export type ResultatTitrage =
  | { statut: "ok"; proposition: PropositionTitrage }
  | { statut: "echec"; erreur: string; quota: boolean };

function echecTitrage(erreur: string, quota = false): ResultatTitrage {
  return { statut: "echec", erreur, quota };
}

async function analyserUn(id: string): Promise<ResultatTitrage> {
  if (!UUID.test(id)) return echecTitrage("Élément introuvable.");

  const supabase = createAdminClient();
  const { data: element, error } = await supabase
    .from("collection_items")
    .select("type, url, thumbnail_url, titre")
    .eq("id", id)
    .maybeSingle();
  if (error) return echecTitrage("L'élément n'a pas pu être lu. Réessaie.");
  if (!element) return echecTitrage("Élément introuvable.");

  // Une photo est lue en entier ; pour une vidéo, `url` est le lien de la
  // page (pas une image) : seule la miniature est envoyée, avec la légende.
  const estVideo = element.type === "tiktok" || element.type === "youtube";
  const debutImage = Date.now();
  const image = await telechargerImage(estVideo ? element.thumbnail_url : element.url);
  const dureeImage = Date.now() - debutImage;
  if (!image && !nettoyerTexte(element.titre)) {
    return echecTitrage("Rien à analyser : l'image est introuvable et il n'y a pas de texte.");
  }

  const debutGemini = Date.now();
  const resultat = await appelerGemini({
    prompt: construirePromptTitrage(element, image !== null),
    images: image ? [image] : undefined,
    schema: SCHEMA_TITRAGE,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.2,
    etiquette: "titrage-collection",
  });
  // Durées en journal : de quoi savoir, si c'est lent, si c'est l'image ou Gemini.
  console.info(
    `[titrage-collection] ${element.type} image=${image ? "oui" : "non"} téléchargement=${dureeImage}ms gemini=${Date.now() - debutGemini}ms ${resultat.ok ? "ok" : resultat.code}`
  );
  if (!resultat.ok) {
    return resultat.code === "quota"
      ? echecTitrage(MESSAGE_QUOTA_GEMINI, true)
      : echecTitrage(`Gemini n'a pas pu lire cet élément (${resultat.detail})`);
  }
  return { statut: "ok", proposition: lireReponseTitrage(resultat.brut, element.titre) };
}

export async function analyserElementCollection(id: string): Promise<ResultatTitrage> {
  return analyserUn(id);
}

/**
 * Analyse un paquet d'éléments (au plus `TAILLE_PAQUET_TITRAGE`) en parallèle :
 * un résultat par identifiant, dans le même ordre. Chaque élément échoue seul,
 * sans entraîner les autres.
 */
export async function analyserElementsCollection(ids: string[]): Promise<ResultatTitrage[]> {
  const liste = Array.isArray(ids) ? ids.map(String) : [];
  if (liste.length > TAILLE_PAQUET_TITRAGE) return liste.map(() => echecTitrage("Trop d'éléments d'un coup."));
  return Promise.all(
    liste.map((id) => analyserUn(id).catch(() => echecTitrage("L'analyse a échoué de façon inattendue.")))
  );
}

// --- Application (écriture) ---

export type ElementTitrageValide = { id: string; titre: string; description: string };
export type ResultatApplicationTitrage = { appliques: number; echecs: number };

// 42703 = colonne inexistante (Postgres), PGRST204 = colonne absente du cache de
// schéma (PostgREST) : la migration de `description` n'est pas encore appliquée.
function colonneAbsente(code: string | undefined): boolean {
  return code === "42703" || code === "PGRST204";
}

export async function appliquerTitrage(
  collectionId: string,
  elements: ElementTitrageValide[]
): Promise<ActionResult<ResultatApplicationTitrage>> {
  if (!UUID.test(String(collectionId))) return fail("Collection introuvable.");
  if (!Array.isArray(elements) || elements.length === 0) return fail("Rien à appliquer.");
  if (elements.length > LOT_MAX_APPLIQUE) return fail("Trop d'éléments d'un coup.");

  const valides: ElementTitrageValide[] = [];
  for (const element of elements) {
    const titre = nettoyerTexte(element?.titre).slice(0, TITRE_MAX);
    const description = nettoyerTexte(element?.description).slice(0, DESCRIPTION_MAX);
    if (!UUID.test(String(element?.id)) || !titre) return fail("Un des titres est vide.");
    valides.push({ id: element.id, titre, description });
  }

  const supabase = createAdminClient();
  let appliques = 0;
  for (const { id, titre, description } of valides) {
    const { data, error } = await supabase
      .from("collection_items")
      .update({ titre, description: description || null })
      .eq("id", id)
      .eq("collection_id", collectionId)
      .select("id");
    if (error) {
      if (colonneAbsente(error.code)) {
        return fail("La colonne « description » n'existe pas encore : applique d'abord la migration SQL de la collection.");
      }
      console.error("appliquerTitrage: mise à jour refusée", error);
      continue;
    }
    if ((data?.length ?? 0) > 0) appliques += 1;
  }

  revalidatePath("/collection");
  revalidatePath(`/collection/${collectionId}`);
  return ok({ appliques, echecs: valides.length - appliques });
}
