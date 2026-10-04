// Fonctions pures des événements légers (rendez-vous sans case à cocher) :
// l'heure de fin est stockée, la durée n'existe qu'au formulaire.

export const HEURE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Durées proposées au formulaire (minutes). Le serveur accepte toute durée
// qui tient dans la journée ; la liste ne sert qu'à la saisie.
export const DUREES_EVENEMENT = [15, 30, 45, 60, 90, 120, 180] as const;
export const DUREE_EVENEMENT_PAR_DEFAUT = 60;

const MINUTES_PAR_JOUR = 24 * 60;

function enMinutes(heure: string): number {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

function enHeure(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Heure de fin = heure de début + durée. `null` si l'heure est invalide, la
 * durée n'est pas un entier positif, ou si l'événement déborderait sur le jour
 * suivant (la grille horaire ne représente qu'une journée).
 */
export function calculerHeureFin(heure: string, dureeMinutes: number): string | null {
  const debut = heure.slice(0, 5);
  if (!HEURE_REGEX.test(debut)) return null;
  if (!Number.isInteger(dureeMinutes) || dureeMinutes < 1) return null;
  const fin = enMinutes(debut) + dureeMinutes;
  return fin < MINUTES_PAR_JOUR ? enHeure(fin) : null;
}

/** Durée en minutes entre deux heures `HH:MM[:SS]` ; `null` si incohérentes. */
export function dureeEvenement(heure: string, heureFin: string): number | null {
  const d = heure.slice(0, 5);
  const f = heureFin.slice(0, 5);
  if (!HEURE_REGEX.test(d) || !HEURE_REGEX.test(f)) return null;
  const duree = enMinutes(f) - enMinutes(d);
  return duree > 0 ? duree : null;
}

/** Libellé de la plage (« 14:30 – 15:30 »), sans les secondes de Postgres. */
export function libellePlage(heure: string, heureFin: string): string {
  return `${heure.slice(0, 5)} – ${heureFin.slice(0, 5)}`;
}
