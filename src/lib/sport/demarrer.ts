"use client";

import { getDernieresSeries, type RoutineAvecExercices } from "@/app/actions/sport";
import { ecrireBrouillon } from "./brouillon";
import type { ExerciceListe } from "./compute";
import {
  creerBrouillon,
  REPOS_PAR_DEFAUT_S,
  type Brouillon,
  type NouvelExercice,
  type SeriePrecedente,
} from "./seance";

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

function nomParDefaut(maintenant: Date): string {
  const jour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
  return `Séance du ${jour.format(maintenant)}`;
}

/** Exercice de la bibliothèque, prêt à ajouter à une séance en cours. */
export async function exerciceDepuisBibliotheque(exercice: ExerciceListe): Promise<NouvelExercice> {
  const precedents = await chargerPrecedents([exercice.id]);
  return {
    exerciceId: exercice.id,
    nom: exercice.nom_fr,
    image: exercice.image,
    typeMesure: exercice.typeMesure,
    reposS: REPOS_PAR_DEFAUT_S,
    nbSeries: NB_SERIES_PAR_DEFAUT,
    precedent: precedents[exercice.id] ?? [],
  };
}

/** Démarre une séance depuis une routine et la range dans le stockage local. */
export async function demarrerDepuisRoutine(routine: RoutineAvecExercices): Promise<Brouillon> {
  const precedents = await chargerPrecedents(routine.exercices.map((e) => e.exerciceId));
  const brouillon = creerBrouillon({
    nom: routine.nom,
    routineId: routine.id,
    maintenant: new Date().toISOString(),
    exercices: routine.exercices.map((e) => ({
      exerciceId: e.exerciceId,
      nom: e.nom,
      image: e.image,
      typeMesure: e.typeMesure,
      reposS: e.reposS,
      nbSeries: e.nbSeries,
      repsCible: e.repsCible,
      precedent: precedents[e.exerciceId] ?? [],
    })),
  });
  await ecrireBrouillon(brouillon);
  return brouillon;
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
  await ecrireBrouillon(brouillon);
  return brouillon;
}
