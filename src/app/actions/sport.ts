"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ExerciceListe } from "@/lib/sport/compute";
import type { Tables } from "@/lib/supabase/types";

const BUCKET_IMAGES = "sport-exercices";

export type BibliothequeExercices = {
  /** Préfixe public du bucket : `${urlImages}/${chemin}` donne l'URL d'une image. */
  urlImages: string;
  exercices: ExerciceListe[];
};

export type ExerciceDetail = Tables<"sport_exercices"> & { urlImages: string };

function urlImages(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_IMAGES}`;
}

/**
 * Bibliothèque complète (~900 lignes, colonnes légères) : filtrée et cherchée
 * côté client, donc lue en une fois. Triée en français ici (la collation de
 * Postgres classerait « Écarté » après « Z »).
 */
export async function getBibliothequeExercices(): Promise<BibliothequeExercices> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sport_exercices")
    .select("id, nom_fr, nom_en, muscle_principal, equipement, categorie, niveau, images")
    // PostgREST plafonne à 1000 lignes par requête ; la bibliothèque en compte ~880.
    .range(0, 999);
  if (error) throw new Error(error.message);

  const exercices: ExerciceListe[] = data
    .map(({ images, ...exercice }) => ({ ...exercice, image: images[0] ?? null }))
    .sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, "fr"));

  return { urlImages: urlImages(), exercices };
}

export async function getExercice(id: string): Promise<ExerciceDetail | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("sport_exercices").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, urlImages: urlImages() } : null;
}
