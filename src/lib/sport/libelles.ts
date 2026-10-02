// Libellés français des valeurs de free-exercise-db stockées en base (slugs
// anglais dans sport_exercices). Les slugs restent la clé de filtre ; seuls
// les libellés sont traduits, ici, pour ne pas multiplier les lignes en base.

/** Muscles principaux, dans l'ordre d'affichage des filtres (haut du corps → bas). */
export const MUSCLES: readonly { slug: string; label: string }[] = [
  { slug: "chest", label: "Pectoraux" },
  { slug: "shoulders", label: "Épaules" },
  { slug: "biceps", label: "Biceps" },
  { slug: "triceps", label: "Triceps" },
  { slug: "forearms", label: "Avant-bras" },
  { slug: "lats", label: "Dorsaux" },
  { slug: "middle back", label: "Milieu du dos" },
  { slug: "lower back", label: "Lombaires" },
  { slug: "traps", label: "Trapèzes" },
  { slug: "neck", label: "Cou" },
  { slug: "abdominals", label: "Abdominaux" },
  { slug: "quadriceps", label: "Quadriceps" },
  { slug: "hamstrings", label: "Ischio-jambiers" },
  { slug: "glutes", label: "Fessiers" },
  { slug: "calves", label: "Mollets" },
  { slug: "adductors", label: "Adducteurs" },
  { slug: "abductors", label: "Abducteurs" },
];

export const EQUIPEMENTS: readonly { slug: string; label: string }[] = [
  { slug: "barbell", label: "Barre" },
  { slug: "dumbbell", label: "Haltères" },
  { slug: "cable", label: "Poulie" },
  { slug: "machine", label: "Machine" },
  { slug: "body only", label: "Poids du corps" },
  { slug: "kettlebells", label: "Kettlebell" },
  { slug: "bands", label: "Élastiques" },
  { slug: "e-z curl bar", label: "Barre EZ" },
  { slug: "medicine ball", label: "Médecine-ball" },
  { slug: "exercise ball", label: "Swiss ball" },
  { slug: "foam roll", label: "Rouleau" },
  { slug: "other", label: "Autre" },
];

/** Valeur de filtre pour les exercices sans équipement renseigné. */
export const EQUIPEMENT_AUTRE = "other";

const NIVEAUX: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  expert: "Expert",
};

const CATEGORIES: Record<string, string> = {
  strength: "Musculation",
  stretching: "Étirements",
  plyometrics: "Pliométrie",
  powerlifting: "Force athlétique",
  "olympic weightlifting": "Haltérophilie",
  strongman: "Strongman",
  cardio: "Cardio",
};

const parSlug = (liste: readonly { slug: string; label: string }[]) =>
  new Map(liste.map((e) => [e.slug, e.label]));
const MUSCLES_PAR_SLUG = parSlug(MUSCLES);
const EQUIPEMENTS_PAR_SLUG = parSlug(EQUIPEMENTS);

export function libelleMuscle(slug: string): string {
  return MUSCLES_PAR_SLUG.get(slug) ?? slug;
}

/** Un équipement absent (null) est présenté comme « Autre ». */
export function libelleEquipement(slug: string | null): string {
  return EQUIPEMENTS_PAR_SLUG.get(slug ?? EQUIPEMENT_AUTRE) ?? slug ?? "Autre";
}

export function libelleNiveau(slug: string | null): string | null {
  return slug ? (NIVEAUX[slug] ?? slug) : null;
}

export function libelleCategorie(slug: string): string {
  return CATEGORIES[slug] ?? slug;
}
