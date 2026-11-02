"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  DESCRIPTION_MAX,
  SCHEMA_TITRAGE,
  TAILLE_MAX_IMAGE_OCTETS,
  TITRE_MAX,
  construirePromptTitrage,
  lireReponseTitrage,
  type PropositionTitrage,
} from "@/lib/collection/titrage";
import { nettoyerTexte } from "@/lib/documents/tri";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { createAdminClient } from "@/lib/supabase/admin";

// Titrage d'un élément de la collection par Gemini, en deux temps avec un
// aperçu entre les deux (même principe que le tri du vrac des documents) :
// `analyserElementCollection` (un élément, lecture seule, appelée une fois par
// élément pour afficher la progression et isoler les échecs), puis
// `appliquerTitrage` (écrit seulement les propositions validées).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TELECHARGEMENT_TIMEOUT_MS = 15_000;
const GEMINI_TIMEOUT_MS = 40_000;
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

type Image = { mimeType: string; data: string };

/** Image de l'élément (photo, ou miniature d'une vidéo), ou null si elle est illisible ou trop lourde. */
async function telechargerImage(url: string | null): Promise<Image | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(TELECHARGEMENT_TIMEOUT_MS) });
    if (!reponse.ok) return null;
    const type = reponse.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    if (Number(reponse.headers.get("content-length")) > TAILLE_MAX_IMAGE_OCTETS) return null;
    const octets = Buffer.from(await reponse.arrayBuffer());
    if (octets.length > TAILLE_MAX_IMAGE_OCTETS) return null;
    return { mimeType: type.split(";")[0].trim(), data: octets.toString("base64") };
  } catch {
    return null;
  }
}

export async function analyserElementCollection(id: string): Promise<ResultatTitrage> {
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
  const image = await telechargerImage(estVideo ? element.thumbnail_url : element.url);
  if (!image && !nettoyerTexte(element.titre)) {
    return echecTitrage("Rien à analyser : l'image est introuvable et il n'y a pas de texte.");
  }

  const resultat = await appelerGemini({
    prompt: construirePromptTitrage(element, image !== null),
    images: image ? [image] : undefined,
    schema: SCHEMA_TITRAGE,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.2,
    etiquette: "titrage-collection",
  });
  if (!resultat.ok) {
    return resultat.code === "quota"
      ? echecTitrage(MESSAGE_QUOTA_GEMINI, true)
      : echecTitrage(`Gemini n'a pas pu lire cet élément (${resultat.detail})`);
  }
  return { statut: "ok", proposition: lireReponseTitrage(resultat.brut, element.titre) };
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
