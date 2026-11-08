"use server";

import { estUrlImageAnalysable, hoteStockageApp, telechargerImage } from "@/lib/collection/image";
import {
  COLLECTIONS_MAX_RANGEMENT,
  EXEMPLES_PAR_COLLECTION,
  SCHEMA_RANGEMENT,
  construireExemples,
  construirePromptRangement,
  lireReponseRangement,
  type CollectionContexte,
} from "@/lib/collection/rangement";
import { estTypeVideo } from "@/lib/collection/video";
import { nettoyerTexte } from "@/lib/documents/tri";
import { analyserPaquet, type Analyse, type EchecAnalyse } from "@/lib/gemini/analyse";
import { createAdminClient } from "@/lib/supabase/admin";

// Suggestion de rangement sur l'écran de partage : Gemini désigne la collection
// existante la plus probable pour la photo ou la vidéo qu'on vient de partager.
// Lecture seule : l'élément n'est rattaché qu'au clic sur « Ajouter »
// (rattacherPhotoACollection).

const TITRE_MAX_ENTREE = 300;
const SUPPLEMENT_LECTURE = 3;

export type EntreeRangement = {
  /** Première photo partagée (URL du stockage), ou null. */
  photoUrl: string | null;
  video: { type: string; thumbnailUrl: string; titre: string } | null;
};

// Discriminant `statut` et non `ok` : voir `@/lib/gemini/analyse` (contrat `runAction`).
export type ResultatRangement = { statut: "ok"; collectionId: string | null } | EchecAnalyse;

function echecRangement(erreur: string): EchecAnalyse {
  return { statut: "echec", erreur, quota: false };
}

type DemandeRangement = {
  element: { type: string; titre: string | null };
  urlImage: string | null;
  collections: CollectionContexte[];
};

/** Suggestion = identifiant de la collection choisie, ou null si Gemini n'en retient aucune. */
const RANGEMENT: Analyse<DemandeRangement, CollectionContexte[], string | null> = {
  etiquette: "rangement-collection",
  schema: SCHEMA_RANGEMENT,
  verbe: "ranger cet élément",
  tailleMax: 1,
  timeoutMs: 30_000,
  temperature: 0.1,
  async preparer({ element, urlImage, collections }) {
    const image =
      urlImage && estUrlImageAnalysable(urlImage, hoteStockageApp()) ? await telechargerImage(urlImage) : null;
    if (!image && !element.titre) return { refus: "Rien à analyser : l'image est introuvable et il n'y a pas de texte." };
    return {
      prompt: construirePromptRangement(element, image !== null, collections),
      images: image ? [image] : undefined,
      contexte: collections,
    };
  },
  lire(brut, collections) {
    const indice = lireReponseRangement(brut, collections.length);
    return indice === null ? null : collections[indice].id;
  },
};

type LigneCollection = { id: string; nom: string; collection_items: { titre: string | null; description?: string | null }[] };

async function lireCollections(): Promise<CollectionContexte[] | null> {
  const supabase = createAdminClient();
  const limite = EXEMPLES_PAR_COLLECTION * SUPPLEMENT_LECTURE;

  // La colonne `description` n'existe qu'après la migration de la collection :
  // sans elle, on se contente des titres.
  const avecDescription = await supabase
    .from("collections")
    .select("id, nom, collection_items(titre, description, created_at)")
    .order("ordre", { ascending: true })
    .order("created_at", { ascending: false, referencedTable: "collection_items" })
    .limit(limite, { referencedTable: "collection_items" });
  let lignes = avecDescription.data as LigneCollection[] | null;

  if (avecDescription.error) {
    const titresSeuls = await supabase
      .from("collections")
      .select("id, nom, collection_items(titre, created_at)")
      .order("ordre", { ascending: true })
      .order("created_at", { ascending: false, referencedTable: "collection_items" })
      .limit(limite, { referencedTable: "collection_items" });
    if (titresSeuls.error) return null;
    lignes = titresSeuls.data as LigneCollection[] | null;
  }

  return (lignes ?? []).slice(0, COLLECTIONS_MAX_RANGEMENT).map((l) => ({
    id: l.id,
    nom: l.nom,
    exemples: construireExemples(l.collection_items ?? []),
  }));
}

export async function suggererCollection(entree: EntreeRangement): Promise<ResultatRangement> {
  const video = entree?.video && estTypeVideo(String(entree.video.type)) ? entree.video : null;
  const photoUrl = typeof entree?.photoUrl === "string" ? entree.photoUrl : null;
  if (!video && !photoUrl) return echecRangement("Rien à ranger.");

  const element = {
    type: video ? String(video.type) : "photo",
    titre: video ? nettoyerTexte(video.titre).slice(0, TITRE_MAX_ENTREE) : null,
  };

  const collections = await lireCollections();
  if (collections === null) return echecRangement("Les collections n'ont pas pu être lues.");
  // Rien à choisir : inutile de consommer le quota Gemini.
  if (collections.length === 0) return { statut: "ok", collectionId: null };

  const urlImage = video ? nettoyerTexte(video.thumbnailUrl) : photoUrl;
  const [resultat] = await analyserPaquet(RANGEMENT, [{ element, urlImage, collections }]);
  return resultat.statut === "ok" ? { statut: "ok", collectionId: resultat.suggestion } : resultat;
}
