// Planning hebdomadaire d'entraînement : les jours de la semaine marqués
// « entraînement » ont la cible d'entraînement, tous les autres la cible de
// repos. Fonctions pures : le type d'un jour se déduit de sa seule date, sans
// rien mémoriser par date.

export type JourType = "repos" | "entrainement";

/** Jours de la semaine, numérotés comme en ISO 8601 (lundi = 1 … dimanche = 7). */
export const JOURS_SEMAINE: readonly { iso: number; court: string; long: string }[] = [
  { iso: 1, court: "L", long: "Lundi" },
  { iso: 2, court: "M", long: "Mardi" },
  { iso: 3, court: "M", long: "Mercredi" },
  { iso: 4, court: "J", long: "Jeudi" },
  { iso: 5, court: "V", long: "Vendredi" },
  { iso: 6, court: "S", long: "Samedi" },
  { iso: 7, court: "D", long: "Dimanche" },
];

export function estJourType(valeur: unknown): valeur is JourType {
  return valeur === "repos" || valeur === "entrainement";
}

/** Jour de la semaine (1 = lundi … 7 = dimanche) d'une date `YYYY-MM-DD`. */
export function jourSemaineIso(date: string): number {
  const jour = new Date(`${date}T00:00:00Z`).getUTCDay();
  return jour === 0 ? 7 : jour;
}

/**
 * Type du jour `date` d'après le planning. Un planning vide (rien de réglé)
 * donne « repos » partout.
 */
export function jourTypePourDate(date: string, joursEntrainement: readonly number[]): JourType {
  return joursEntrainement.includes(jourSemaineIso(date)) ? "entrainement" : "repos";
}

/** Valeur stockée ou saisie → jours valides (1 à 7), sans doublon, triés. */
export function normaliserJours(valeur: unknown): number[] {
  if (!Array.isArray(valeur)) return [];
  const jours = new Set<number>();
  for (const v of valeur) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 7) jours.add(n);
  }
  return [...jours].sort((a, b) => a - b);
}
