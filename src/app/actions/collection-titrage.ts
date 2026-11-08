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
import { analyserPaquet, type Analyse, type ResultatAnalyse } from "@/lib/gemini/analyse";
import { createAdminClient } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/uuid";

// Titrage d'un élément de la collection par Gemini, en deux temps avec un
// aperçu entre les deux (même principe que le tri du vrac des documents) :
// `analyserElementsCollection` (lecture seule, un paquet par appel pour
// afficher la progression et isoler les échecs), puis `appliquerTitrage`
// (écrit seulement les suggestions validées). Timeout, quota, journal de durée
// et isolation des échecs : voir `@/lib/gemini/analyse`.

const LOT_MAX_APPLIQUE = 50;

export type ResultatTitrage = ResultatAnalyse<PropositionTitrage>;

/** Ce que `preparer` garde de l'élément pour que `lire` retrouve son titre d'origine. */
type ContexteTitrage = { titre: string | null };

const TITRAGE: Analyse<string, ContexteTitrage, PropositionTitrage> = {
  etiquette: "titrage-collection",
  schema: SCHEMA_TITRAGE,
  verbe: "lire cet élément",
  tailleMax: TAILLE_PAQUET_TITRAGE,
  temperature: 0.2,
  async preparer(id) {
    if (!estUuid(id)) return { refus: "Élément introuvable." };

    const supabase = createAdminClient();
    const { data: element, error } = await supabase
      .from("collection_items")
      .select("type, url, thumbnail_url, titre")
      .eq("id", id)
      .maybeSingle();
    if (error) return { refus: "L'élément n'a pas pu être lu. Réessaie." };
    if (!element) return { refus: "Élément introuvable." };

    // Une photo est lue en entier ; pour une vidéo, `url` est le lien de la
    // page (pas une image) : seule la miniature est envoyée, avec la légende.
    const estVideo = element.type === "tiktok" || element.type === "youtube";
    const image = await telechargerImage(estVideo ? element.thumbnail_url : element.url);
    if (!image && !nettoyerTexte(element.titre)) {
      return { refus: "Rien à analyser : l'image est introuvable et il n'y a pas de texte." };
    }
    return {
      prompt: construirePromptTitrage(element, image !== null),
      images: image ? [image] : undefined,
      contexte: { titre: element.titre },
    };
  },
  lire: (brut, { titre }) => lireReponseTitrage(brut, titre),
};

/**
 * Analyse un paquet d'éléments (au plus `TAILLE_PAQUET_TITRAGE`) en parallèle :
 * un résultat par identifiant, dans le même ordre. Chaque élément échoue seul,
 * sans entraîner les autres.
 */
export async function analyserElementsCollection(ids: string[]): Promise<ResultatTitrage[]> {
  return analyserPaquet(TITRAGE, Array.isArray(ids) ? ids.map(String) : []);
}

export async function analyserElementCollection(id: string): Promise<ResultatTitrage> {
  return (await analyserElementsCollection([id]))[0];
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
  if (!estUuid(String(collectionId))) return fail("Collection introuvable.");
  if (!Array.isArray(elements) || elements.length === 0) return fail("Rien à appliquer.");
  if (elements.length > LOT_MAX_APPLIQUE) return fail("Trop d'éléments d'un coup.");

  const valides: ElementTitrageValide[] = [];
  for (const element of elements) {
    const titre = nettoyerTexte(element?.titre).slice(0, TITRE_MAX);
    const description = nettoyerTexte(element?.description).slice(0, DESCRIPTION_MAX);
    if (!estUuid(String(element?.id)) || !titre) return fail("Un des titres est vide.");
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
