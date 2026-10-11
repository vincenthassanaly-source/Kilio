"use client";

import { getDernieresSeries, getRecordsExercices, getRoutine, getRoutines, getSeancePlanifiee } from "@/app/actions/musculation";
import type { ExerciceCatalogue } from "./serveur";
import { ecrireBrouillon } from "./brouillon";
import { exerciceDepuisRoutine, type RoutineDetail, type RoutineResume } from "./routines";
import type { RecordsExercice } from "./stats";
import { creerBrouillon, REPOS_PAR_DEFAUT_S, type Brouillon, type NouvelExercice, type SeriePrecedente } from "./seance";

const NB_SERIES_PAR_DEFAUT = 3;

/**
 * Dernières séries de chaque exercice (repère « Précédent » et préremplissage).
 * Hors ligne ou en cas d'erreur, la séance démarre simplement sans historique :
 * ne jamais empêcher de s'entraîner.
 */
export async function chargerPrecedents(ids: string[]): Promise<Record<string, SeriePrecedente[]>> {
  if (ids.length === 0) return {};
  try {
    return await getDernieresSeries(ids);
  } catch {
    return {};
  }
}

/**
 * Records de chaque exercice, pour annoncer un nouveau record pendant la séance.
 * Même règle que les précédents : sans réseau, la séance démarre sans eux.
 */
export async function chargerRecords(ids: string[]): Promise<Record<string, RecordsExercice>> {
  if (ids.length === 0) return {};
  try {
    return await getRecordsExercices(ids);
  } catch {
    return {};
  }
}

function nomParDefaut(maintenant: Date): string {
  const jour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
  return `Séance du ${jour.format(maintenant)}`;
}

/** Exercice du catalogue, prêt à ajouter à une séance en cours. */
export async function exerciceDepuisCatalogue(exercice: ExerciceCatalogue): Promise<NouvelExercice> {
  const [precedents, records] = await Promise.all([chargerPrecedents([exercice.id]), chargerRecords([exercice.id])]);
  return {
    exerciceId: exercice.id,
    nom: exercice.nom,
    mode: exercice.mode,
    reposS: exercice.reposDefautS ?? REPOS_PAR_DEFAUT_S,
    nbSeries: NB_SERIES_PAR_DEFAUT,
    precedent: precedents[exercice.id] ?? [],
    records: records[exercice.id] ?? null,
  };
}

/** Séance libre : on ajoute les exercices au fil de l'entraînement. */
export async function demarrerSeanceVide(seanceId: string | null = null): Promise<Brouillon> {
  const maintenant = new Date();
  let nom = nomParDefaut(maintenant);
  if (seanceId) {
    // Séance planifiée : son type (LEGS / PUSH / PULL) nomme la séance. Hors
    // ligne ou séance introuvable, on démarre quand même, sans lien.
    try {
      const planifiee = await getSeancePlanifiee(seanceId);
      if (planifiee) nom = planifiee.type;
      else seanceId = null;
    } catch {
      // Séance gardée liée : le serveur ignore le lien si elle a disparu.
    }
  }
  const brouillon = creerBrouillon({
    nom,
    routineId: null,
    seanceId,
    maintenant: maintenant.toISOString(),
    exercices: [],
  });
  await ecrireBrouillon(brouillon, true);
  return brouillon;
}

/** Séance démarrée depuis une routine : les cibles de la routine, puis la dernière performance. */
export async function demarrerDepuisRoutine(routine: RoutineDetail, seanceId: string | null = null): Promise<Brouillon> {
  const ids = routine.exercices.map((e) => e.exerciceId);
  const [precedents, records] = await Promise.all([chargerPrecedents(ids), chargerRecords(ids)]);
  const base = creerBrouillon({
    nom: routine.nom,
    routineId: routine.id,
    seanceId,
    maintenant: new Date().toISOString(),
    exercices: [],
  });
  const brouillon: Brouillon = {
    ...base,
    exercices: routine.exercices.map((e) =>
      exerciceDepuisRoutine(e, precedents[e.exerciceId] ?? [], undefined, records[e.exerciceId] ?? null),
    ),
  };
  await ecrireBrouillon(brouillon, true);
  return brouillon;
}

/** Résultat de la préparation d'une séance planifiée : démarrée, ou plusieurs routines à départager. */
export type PreparationSeance =
  | { brouillon: Brouillon }
  | { choix: { seanceId: string; type: string; routines: RoutineResume[] } };

/**
 * « Commencer » une séance planifiée : sa routine de même type (LEGS / PUSH /
 * PULL) est choisie d'office s'il n'y en a qu'une, proposée s'il y en a
 * plusieurs, et la séance est libre s'il n'y en a aucune. Hors ligne ou en cas
 * d'erreur, on démarre quand même une séance libre liée à la séance planifiée.
 */
export async function preparerSeancePlanifiee(seanceId: string): Promise<PreparationSeance> {
  try {
    const planifiee = await getSeancePlanifiee(seanceId);
    if (!planifiee) return { brouillon: await demarrerSeanceVide(null) };

    const { routines } = await getRoutines();
    const candidates = routines.filter((r) => r.typeSeance === planifiee.type && r.nbExercices > 0);
    if (candidates.length === 0) return { brouillon: await demarrerSeanceVide(seanceId) };
    if (candidates.length > 1) return { choix: { seanceId, type: planifiee.type, routines: candidates } };

    const routine = await getRoutine(candidates[0].id);
    if (!routine) return { brouillon: await demarrerSeanceVide(seanceId) };
    return { brouillon: await demarrerDepuisRoutine(routine, seanceId) };
  } catch {
    return { brouillon: await demarrerSeanceVide(seanceId) };
  }
}
