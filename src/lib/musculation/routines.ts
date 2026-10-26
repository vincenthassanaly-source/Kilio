// Routines : modèles de séances réutilisables (exercices + séries cibles).
// Logique pure (aucun accès réseau ni React), partagée par les Server Actions,
// l'éditeur de routine et le démarrage d'une séance depuis une routine.
import { creerExerciceBrouillon, REPOS_PAR_DEFAUT_S, type ExerciceBrouillon, type SeriePrecedente } from "./seance";
import type { CleAnimation } from "./animations";
import { estTypeSeance } from "@/lib/seances/compute";
import type { RecordsExercice } from "./stats";
import { estModeSaisie, estTypeSerie, type ModeSaisie, type TypeSeance, type TypeSerie } from "./constantes";

export type RoutineSerie = {
  type: TypeSerie;
  poids: number | null;
  reps: number | null;
  duree: number | null;
  distance: number | null;
  vitesse?: number | null;
};

/** Exercice d'une routine tel qu'il est envoyé à l'enregistrement. */
type RoutineExerciceEntree = {
  exerciceId: string;
  /** Repos propre à cette routine ; null = repos de l'exercice (puis global). */
  reposS: number | null;
  series: RoutineSerie[];
};

export type RoutineEntree = {
  /** Absent à la création. */
  id?: string;
  nom: string;
  typeSeance: TypeSeance | null;
  dossierId: string | null;
  exercices: RoutineExerciceEntree[];
};

/** Exercice d'une routine relu depuis la base, avec ce qu'il faut pour l'afficher. */
export type RoutineExerciceDetail = RoutineExerciceEntree & {
  nom: string;
  mode: ModeSaisie;
  /** Repos par défaut de l'exercice au catalogue. */
  reposExerciceS: number | null;
  animation?: CleAnimation | null;
};

export type RoutineDetail = {
  id: string;
  nom: string;
  typeSeance: TypeSeance | null;
  dossierId: string | null;
  exercices: RoutineExerciceDetail[];
};

export type RoutineResume = {
  id: string;
  nom: string;
  typeSeance: TypeSeance | null;
  dossierId: string | null;
  nbExercices: number;
};

export type DossierRoutines = { id: string; nom: string };

export const NB_EXERCICES_ROUTINE_MAX = 40;
export const NB_SERIES_EXERCICE_MAX = 20;

// --- Démarrage ------------------------------------------------------------

/**
 * Exercice de séance à partir d'une routine : une série par série cible. Les
 * valeurs cibles de la routine priment ; à défaut, la dernière performance
 * (« Précédent ») préremplit la série.
 */
export function exerciceDepuisRoutine(
  exercice: RoutineExerciceDetail,
  precedent: SeriePrecedente[],
  genererId?: () => string,
  records: RecordsExercice | null = null,
): ExerciceBrouillon {
  const base = creerExerciceBrouillon(
    {
      exerciceId: exercice.exerciceId,
      nom: exercice.nom,
      mode: exercice.mode,
      reposS: exercice.reposS ?? exercice.reposExerciceS ?? REPOS_PAR_DEFAUT_S,
      nbSeries: Math.max(1, exercice.series.length),
      precedent,
      records,
      animation: exercice.animation ?? null,
    },
    genererId,
  );
  return {
    ...base,
    series: base.series.map((serie, i) => {
      const cible = exercice.series[i];
      if (!cible) return serie;
      return {
        ...serie,
        type: cible.type,
        poids: cible.poids ?? serie.poids,
        reps: cible.reps ?? serie.reps,
        duree: cible.duree ?? serie.duree,
        distance: cible.distance ?? serie.distance,
        vitesse: cible.vitesse ?? serie.vitesse,
      };
    }),
  };
}

// --- Validation côté serveur ----------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function estUuid(valeur: unknown): valeur is string {
  return typeof valeur === "string" && UUID.test(valeur);
}

function nullOuEntier(valeur: unknown, min: number, max: number): boolean {
  return valeur === null || (typeof valeur === "number" && Number.isInteger(valeur) && valeur >= min && valeur <= max);
}

function nullOuNombre(valeur: unknown, min: number, max: number): boolean {
  return valeur === null || (typeof valeur === "number" && Number.isFinite(valeur) && valeur >= min && valeur <= max);
}

/** `null` si la routine est valide, sinon le message à renvoyer à l'appelant. */
export function validerRoutine(routine: unknown): string | null {
  if (!estObjet(routine)) return "Routine invalide.";
  const { id, nom, typeSeance, dossierId, exercices } = routine;
  if (id !== undefined && !estUuid(id)) return "Identifiant de routine invalide.";
  if (typeof nom !== "string" || nom.trim().length < 1 || nom.trim().length > 80) {
    return "Le nom de la routine est requis (80 caractères maximum).";
  }
  if (typeSeance !== null && !(typeof typeSeance === "string" && estTypeSeance(typeSeance))) {
    return "Type de séance invalide (LEGS, PUSH ou PULL).";
  }
  if (dossierId !== null && !estUuid(dossierId)) return "Dossier invalide.";
  if (!Array.isArray(exercices) || exercices.length < 1 || exercices.length > NB_EXERCICES_ROUTINE_MAX) {
    return `Une routine contient entre 1 et ${NB_EXERCICES_ROUTINE_MAX} exercices.`;
  }
  for (const exercice of exercices) {
    if (!estObjet(exercice)) return "Exercice invalide.";
    if (!estUuid(exercice.exerciceId)) return "Exercice invalide.";
    if (!nullOuEntier(exercice.reposS, 0, 1800)) return "Le repos doit être compris entre 0 et 30 minutes.";
    const { series } = exercice;
    if (!Array.isArray(series) || series.length < 1 || series.length > NB_SERIES_EXERCICE_MAX) {
      return `Un exercice contient entre 1 et ${NB_SERIES_EXERCICE_MAX} séries.`;
    }
    for (const serie of series) {
      if (!estObjet(serie)) return "Série invalide.";
      if (!estTypeSerie(serie.type)) return "Type de série invalide.";
      if (!nullOuNombre(serie.poids, -500, 1000)) return "Poids invalide (−500 à 1000 kg).";
      if (!nullOuEntier(serie.reps, 0, 1000)) return "Répétitions invalides (0 à 1000).";
      if (!nullOuEntier(serie.duree, 0, 86400)) return "Durée invalide.";
      if (!nullOuNombre(serie.distance, 0, 1_000_000)) return "Distance invalide.";
      if (serie.vitesse !== undefined && !nullOuNombre(serie.vitesse, 0, 100)) return "Vitesse invalide (0 à 100 km/h).";
    }
  }
  return null;
}

/** Nom de dossier valide : 1 à 60 caractères. */
export function validerNomDossier(nom: unknown): string | null {
  if (typeof nom !== "string" || nom.trim().length < 1 || nom.trim().length > 60) {
    return "Le nom du dossier est requis (60 caractères maximum).";
  }
  return null;
}

/** Valeur lue en base → mode de saisie sûr. */
export function modeOuDefaut(valeur: unknown): ModeSaisie {
  return estModeSaisie(valeur) ? valeur : "poids_reps";
}
