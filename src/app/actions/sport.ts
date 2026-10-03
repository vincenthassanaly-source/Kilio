"use server";

import { updateTag } from "next/cache";
import { setJourTypeJournal } from "@/app/actions/journal";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiParis } from "@/lib/date/paris";
import type { ExerciceListe } from "@/lib/sport/compute";
import { URL_IMAGES_SPORT } from "@/lib/sport/libelles";
import { lirePoses, type PosesExercice } from "@/lib/sport/silhouette";
import {
  validerPayload,
  validerRoutine,
  type RoutineEntree,
  type SeancePayload,
  type SeriePrecedente,
  type TypeMesure,
} from "@/lib/sport/seance";
import { SPORT_ROUTINES_TAG, SPORT_SEANCES_TAG } from "@/lib/sport/tags";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BibliothequeExercices = {
  /** Préfixe public du bucket : `${urlImages}/${chemin}` donne l'URL d'une image. */
  urlImages: string;
  exercices: ExerciceListe[];
};

export type ExerciceDetail = Omit<Tables<"sport_exercices">, "poses"> & {
  urlImages: string;
  poses: PosesExercice | null;
};

function urlImages(): string {
  return URL_IMAGES_SPORT;
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
    .select("id, nom_fr, nom_en, muscle_principal, equipement, categorie, niveau, type_mesure, images, poses")
    // PostgREST plafonne à 1000 lignes par requête ; la bibliothèque en compte ~880.
    .range(0, 999);
  if (error) throw new Error(error.message);

  const exercices: ExerciceListe[] = data
    .map(({ images, type_mesure, poses, ...exercice }) => ({
      ...exercice,
      typeMesure: type_mesure as TypeMesure,
      image: images[0] ?? null,
      poses: lirePoses(poses),
    }))
    .sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, "fr"));

  return { urlImages: urlImages(), exercices };
}

export async function getExercice(id: string): Promise<ExerciceDetail | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("sport_exercices").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, poses: lirePoses(data.poses), urlImages: urlImages() } : null;
}

// --- Routines --------------------------------------------------------------

export type ExerciceRoutine = {
  /** Identifiant de la ligne routine ↔ exercice. */
  id: string;
  exerciceId: string;
  nom: string;
  image: string | null;
  poses: PosesExercice | null;
  typeMesure: TypeMesure;
  nbSeries: number;
  repsCible: number | null;
  reposS: number;
};

export type RoutineAvecExercices = { id: string; nom: string; exercices: ExerciceRoutine[] };

export type RoutinesData = { urlImages: string; routines: RoutineAvecExercices[] };

/** Routines dans l'ordre choisi, chacune avec ses exercices (nom, image, type de mesure). */
export async function getRoutines(): Promise<RoutinesData> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sport_routines")
    .select(
      "id, nom, ordre, created_at, sport_routine_exercices(id, exercice_id, position, nb_series, reps_cible, repos_s, exercice:sport_exercices(nom_fr, images, type_mesure, poses))",
    )
    .order("ordre")
    .order("created_at");
  if (error) throw new Error(error.message);

  const routines = data.map((routine) => ({
    id: routine.id,
    nom: routine.nom,
    exercices: [...routine.sport_routine_exercices]
      .sort((a, b) => a.position - b.position)
      .map((ligne) => ({
        id: ligne.id,
        exerciceId: ligne.exercice_id,
        nom: ligne.exercice?.nom_fr ?? ligne.exercice_id,
        image: ligne.exercice?.images[0] ?? null,
        poses: lirePoses(ligne.exercice?.poses),
        typeMesure: (ligne.exercice?.type_mesure ?? "poids_reps") as TypeMesure,
        nbSeries: ligne.nb_series,
        repsCible: ligne.reps_cible,
        reposS: ligne.repos_s,
      })),
  }));
  return { urlImages: urlImages(), routines };
}

/** Crée la routine, ou remplace son nom et ses exercices si `id` est fourni. */
export async function enregistrerRoutine(entree: RoutineEntree): Promise<ActionResult<{ id: string }>> {
  const erreur = validerRoutine(entree);
  if (erreur) return fail(erreur);

  const supabase = createAdminClient();
  const nom = entree.nom.trim();
  let routineId = entree.id;

  if (routineId) {
    const { data: existante } = await supabase.from("sport_routines").select("id").eq("id", routineId).maybeSingle();
    if (!existante) return fail("Cette routine n'existe plus.");
    const { error } = await supabase.from("sport_routines").update({ nom }).eq("id", routineId);
    if (error) return fail("La routine n'a pas pu être enregistrée. Réessaie.");
    const { error: erreurSuppression } = await supabase
      .from("sport_routine_exercices")
      .delete()
      .eq("routine_id", routineId);
    if (erreurSuppression) return fail("La routine n'a pas pu être enregistrée. Réessaie.");
  } else {
    const { data: derniere } = await supabase
      .from("sport_routines")
      .select("ordre")
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: creee, error } = await supabase
      .from("sport_routines")
      .insert({ nom, ordre: (derniere?.ordre ?? -1) + 1 })
      .select("id")
      .single();
    if (error) return fail("La routine n'a pas pu être créée. Réessaie.");
    routineId = creee.id;
  }

  const { error } = await supabase.from("sport_routine_exercices").insert(
    entree.exercices.map((exercice, position) => ({
      routine_id: routineId,
      exercice_id: exercice.exerciceId,
      position,
      nb_series: exercice.nbSeries,
      reps_cible: exercice.repsCible,
      repos_s: exercice.reposS,
    })),
  );
  if (error) return fail("Les exercices de la routine n'ont pas pu être enregistrés. Réessaie.");

  updateTag(SPORT_ROUTINES_TAG);
  return ok({ id: routineId });
}

export async function supprimerRoutine(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return fail("Routine invalide.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("sport_routines").delete().eq("id", id);
  if (error) return fail("La routine n'a pas pu être supprimée. Réessaie.");
  updateTag(SPORT_ROUTINES_TAG);
  return ok();
}

// --- Séances ---------------------------------------------------------------

export type DerniereSeance = {
  id: string;
  nom: string;
  debutA: string;
  finA: string;
  nbExercices: number;
  nbSeries: number;
  volumeKg: number;
};

export async function getDerniereSeance(): Promise<DerniereSeance | null> {
  const supabase = createAdminClient();
  const { data: seance, error } = await supabase
    .from("sport_seances")
    .select("id, nom, debut_at, fin_at")
    .order("debut_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!seance) return null;

  const { data: series, error: erreurSeries } = await supabase
    .from("sport_series")
    .select("exercice_id, poids_kg, reps")
    .eq("seance_id", seance.id);
  if (erreurSeries) throw new Error(erreurSeries.message);

  return {
    id: seance.id,
    nom: seance.nom,
    debutA: seance.debut_at,
    finA: seance.fin_at,
    nbExercices: new Set(series.map((s) => s.exercice_id)).size,
    nbSeries: series.length,
    volumeKg: Math.round(series.reduce((total, s) => total + (s.poids_kg ?? 0) * (s.reps ?? 0), 0)),
  };
}

/**
 * Séries de la dernière séance où figurait chaque exercice, dans l'ordre :
 * sert de repère (« Précédent ») et de préremplissage au démarrage d'une séance.
 */
export async function getDernieresSeries(exerciceIds: string[]): Promise<Record<string, SeriePrecedente[]>> {
  const ids = [...new Set(exerciceIds.filter((id) => typeof id === "string"))].slice(0, 60);
  if (ids.length === 0) return {};

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sport_series")
    .select("exercice_id, seance_id, position, ordre, poids_kg, reps, duree_s, fait_at")
    .in("exercice_id", ids)
    .order("fait_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const derniereSeance = new Map<string, string>();
  for (const ligne of data) {
    if (!derniereSeance.has(ligne.exercice_id)) derniereSeance.set(ligne.exercice_id, ligne.seance_id);
  }

  const resultat: Record<string, SeriePrecedente[]> = {};
  for (const [exerciceId, seanceId] of derniereSeance) {
    resultat[exerciceId] = data
      .filter((ligne) => ligne.exercice_id === exerciceId && ligne.seance_id === seanceId)
      .sort((a, b) => a.position - b.position || a.ordre - b.ordre)
      .map((ligne) => ({ poids: ligne.poids_kg, reps: ligne.reps, duree: ligne.duree_s }));
  }
  return resultat;
}

/**
 * Enregistre une séance terminée. Idempotent : les identifiants viennent du
 * client, donc renvoyer la même séance (reconnexion après un envoi dont la
 * réponse s'est perdue) la remplace sans créer de doublon.
 */
export async function enregistrerSeance(payload: SeancePayload): Promise<ActionResult> {
  const erreur = validerPayload(payload);
  if (erreur) return fail(erreur);

  const supabase = createAdminClient();
  const jour = aujourdhuiParis(new Date(payload.debutA));

  // Une routine supprimée entre-temps ne doit pas faire échouer l'envoi.
  let routineId = payload.routineId;
  if (routineId) {
    const { data: routine } = await supabase.from("sport_routines").select("id").eq("id", routineId).maybeSingle();
    if (!routine) routineId = null;
  }

  const { error: erreurSeance } = await supabase.from("sport_seances").upsert({
    id: payload.id,
    routine_id: routineId,
    nom: payload.nom.trim(),
    debut_at: payload.debutA,
    fin_at: payload.finA,
    jour,
  });
  if (erreurSeance) return fail("La séance n'a pas pu être enregistrée.");

  const { error: erreurSuppression } = await supabase.from("sport_series").delete().eq("seance_id", payload.id);
  if (erreurSuppression) return fail("La séance n'a pas pu être enregistrée.");

  const { error: erreurSeries } = await supabase.from("sport_series").insert(
    payload.series.map((serie) => ({
      id: serie.id,
      seance_id: payload.id,
      exercice_id: serie.exerciceId,
      position: serie.position,
      ordre: serie.ordre,
      poids_kg: serie.poids === null ? null : Math.round(serie.poids * 100) / 100,
      reps: serie.reps,
      duree_s: serie.duree,
      repos_pris_s: serie.reposPris,
      fait_at: serie.faitA,
    })),
  );
  if (erreurSeries) return fail("Les séries n'ont pas pu être enregistrées.");

  // Une séance enregistrée fait de ce jour un jour d'entraînement dans le
  // journal nutritionnel (jamais l'inverse). Best effort : un échec ici ne
  // doit pas faire rejouer une séance déjà enregistrée.
  await setJourTypeJournal(jour, "entrainement");

  updateTag(SPORT_SEANCES_TAG);
  return ok();
}
