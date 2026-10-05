// Type d'une journée (repos / entraînement) : l'utilisateur marque chaque
// date d'entraînement depuis le Journal (table jours_entrainement). Une date
// sans statut est un jour de repos. Fonctions pures.

export type JourType = "repos" | "entrainement";

export function estJourType(valeur: unknown): valeur is JourType {
  return valeur === "repos" || valeur === "entrainement";
}

/** Type du jour `date` : entraînement si elle figure parmi `datesEntrainement`, sinon repos. */
export function jourTypePourDate(date: string, datesEntrainement: readonly string[]): JourType {
  return datesEntrainement.includes(date) ? "entrainement" : "repos";
}
