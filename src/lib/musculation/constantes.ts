// Vocabulaire du module Musculation. Les valeurs sont celles des contraintes
// CHECK de scripts/migration-musculation-2026-10-11.sql : toute modification
// ici doit être répercutée dans une migration.

export const MUSCLES = [
  "pectoraux",
  "dos",
  "epaules",
  "biceps",
  "triceps",
  "avant_bras",
  "abdos",
  "quadriceps",
  "ischios",
  "fessiers",
  "mollets",
  "adducteurs",
  "abducteurs",
  "trapezes",
  "lombaires",
  "cardio",
  "corps_entier",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  pectoraux: "Pectoraux",
  dos: "Dos",
  epaules: "Épaules",
  biceps: "Biceps",
  triceps: "Triceps",
  avant_bras: "Avant-bras",
  abdos: "Abdos",
  quadriceps: "Quadriceps",
  ischios: "Ischio-jambiers",
  fessiers: "Fessiers",
  mollets: "Mollets",
  adducteurs: "Adducteurs",
  abducteurs: "Abducteurs",
  trapezes: "Trapèzes",
  lombaires: "Lombaires",
  cardio: "Cardio",
  corps_entier: "Corps entier",
};

export const MODES_SAISIE = ["poids_reps", "poids_corps_reps", "duree", "distance_duree", "poids_duree"] as const;
export type ModeSaisie = (typeof MODES_SAISIE)[number];

export const MODE_SAISIE_LABELS: Record<ModeSaisie, string> = {
  poids_reps: "Poids × reps",
  poids_corps_reps: "Poids du corps × reps",
  duree: "Durée",
  distance_duree: "Distance + durée",
  poids_duree: "Poids + durée",
};

export type ChampSerie = "poids_kg" | "reps" | "duree_s" | "distance_m";

/** Colonnes saisies pour une série, selon le mode de saisie de l'exercice. */
export const CHAMPS_PAR_MODE: Record<ModeSaisie, readonly ChampSerie[]> = {
  poids_reps: ["poids_kg", "reps"],
  poids_corps_reps: ["poids_kg", "reps"],
  duree: ["duree_s"],
  distance_duree: ["distance_m", "duree_s"],
  poids_duree: ["poids_kg", "duree_s"],
};

export const TYPES_SERIE = ["normale", "echauffement", "dropset", "echec"] as const;
export type TypeSerie = (typeof TYPES_SERIE)[number];

export const TYPE_SERIE_LABELS: Record<TypeSerie, string> = {
  normale: "Normale",
  echauffement: "Échauffement",
  dropset: "Dropset",
  echec: "À l'échec",
};

/** Types de séance planifiable (identiques à ceux du module Séances). */
export const TYPES_SEANCE = ["LEGS", "PUSH", "PULL"] as const;
export type TypeSeance = (typeof TYPES_SEANCE)[number];

export function estMuscle(valeur: unknown): valeur is Muscle {
  return typeof valeur === "string" && (MUSCLES as readonly string[]).includes(valeur);
}

export function estModeSaisie(valeur: unknown): valeur is ModeSaisie {
  return typeof valeur === "string" && (MODES_SAISIE as readonly string[]).includes(valeur);
}

export function estTypeSerie(valeur: unknown): valeur is TypeSerie {
  return typeof valeur === "string" && (TYPES_SERIE as readonly string[]).includes(valeur);
}

export function estTypeSeance(valeur: unknown): valeur is TypeSeance {
  return typeof valeur === "string" && (TYPES_SEANCE as readonly string[]).includes(valeur);
}

/** Une série d'échauffement ne compte pas dans le volume ni dans les records. */
export function compteDansLeVolume(type: TypeSerie): boolean {
  return type !== "echauffement";
}
