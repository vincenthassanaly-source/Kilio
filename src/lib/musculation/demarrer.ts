"use client";

import { getDernieresSeries, getSeancePlanifiee } from "@/app/actions/musculation";
import type { ExerciceCatalogue } from "./serveur";
import { ecrireBrouillon } from "./brouillon";
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

function nomParDefaut(maintenant: Date): string {
  const jour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
  return `Séance du ${jour.format(maintenant)}`;
}

/** Exercice du catalogue, prêt à ajouter à une séance en cours. */
export async function exerciceDepuisCatalogue(exercice: ExerciceCatalogue): Promise<NouvelExercice> {
  const precedents = await chargerPrecedents([exercice.id]);
  return {
    exerciceId: exercice.id,
    nom: exercice.nom,
    mode: exercice.mode,
    reposS: exercice.reposDefautS ?? REPOS_PAR_DEFAUT_S,
    nbSeries: NB_SERIES_PAR_DEFAUT,
    precedent: precedents[exercice.id] ?? [],
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
