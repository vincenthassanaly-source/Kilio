"use client";

import { getDernieresSeries, getRecordsExercices } from "@/app/actions/musculation";
import type { ExerciceCatalogue } from "./serveur";
import { ecrireBrouillon } from "./brouillon";
import { exerciceDepuisRoutine, type RoutineDetail } from "./routines";
import type { RecordsExercice } from "./stats";
import { creerBrouillon, REPOS_PAR_DEFAUT_S, type Brouillon, type NouvelExercice, type SeriePrecedente } from "./seance";

const NB_SERIES_PAR_DEFAUT = 3;

/**
 * Dernières séries de chaque exercice (repère « Précédent » et préremplissage).
 * Hors ligne ou en cas d'erreur, la séance démarre simplement sans historique :
 * ne jamais empêcher de s'entraîner.
 */
async function chargerPrecedents(ids: string[]): Promise<Record<string, SeriePrecedente[]>> {
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
async function chargerRecords(ids: string[]): Promise<Record<string, RecordsExercice>> {
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
    // Marche : une seule ligne (durée + vitesse), sans repos.
    reposS: exercice.mode === "duree_vitesse" ? 0 : (exercice.reposDefautS ?? REPOS_PAR_DEFAUT_S),
    nbSeries: exercice.mode === "duree_vitesse" ? 1 : NB_SERIES_PAR_DEFAUT,
    precedent: precedents[exercice.id] ?? [],
    records: records[exercice.id] ?? null,
    animation: exercice.animation,
  };
}

/** Séance libre : on ajoute les exercices au fil de l'entraînement. */
export async function demarrerSeanceVide(): Promise<Brouillon> {
  const maintenant = new Date();
  const brouillon = creerBrouillon({
    nom: nomParDefaut(maintenant),
    routineId: null,
    maintenant: maintenant.toISOString(),
    exercices: [],
  });
  await ecrireBrouillon(brouillon, true);
  return brouillon;
}

/** Séance démarrée depuis une routine : les cibles de la routine, puis la dernière performance. */
export async function demarrerDepuisRoutine(routine: RoutineDetail): Promise<Brouillon> {
  const ids = routine.exercices.map((e) => e.exerciceId);
  const [precedents, records] = await Promise.all([chargerPrecedents(ids), chargerRecords(ids)]);
  const base = creerBrouillon({
    nom: routine.nom,
    routineId: routine.id,
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
