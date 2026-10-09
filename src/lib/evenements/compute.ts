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

// --- Journée entière ----------------------------------------------------------

// Un événement « journée entière » reste stocké avec une plage fictive
// (00:00 – 23:59) pour respecter la contrainte `heure_fin > heure` ; les
// écrans l'affichent à part de la grille horaire.
export const HEURE_DEBUT_JOURNEE_ENTIERE = "00:00";
export const HEURE_FIN_JOURNEE_ENTIERE = "23:59";

type AvecJourEntier = { toute_la_journee: boolean };

/** Événements à placer sur la grille horaire (hors journée entière). */
export function evenementsHoraires<T extends AvecJourEntier>(evenements: T[]): T[] {
  return evenements.filter((e) => !e.toute_la_journee);
}

/** Événements « journée entière », affichés en bandeau au-dessus de la grille. */
export function evenementsJourneeEntiere<T extends AvecJourEntier>(evenements: T[]): T[] {
  return evenements.filter((e) => e.toute_la_journee);
}

// --- Récurrence ---------------------------------------------------------------

export type FrequenceEvenement = "quotidien" | "hebdomadaire" | "mensuel" | "annuel";

type Recurrent = {
  date: string;
  recurrence_frequence: FrequenceEvenement | null;
  recurrence_fin: string | null;
};

function ajouterPeriodes(dateISO: string, frequence: FrequenceEvenement, n: number): string {
  const [a, m, j] = dateISO.split("-").map(Number);
  // Calé sur la date d'origine (et non en chaînant d'une occurrence à l'autre) :
  // un événement du 31 janvier retombe le 31 mars, pas le 28 après février.
  const d = new Date(Date.UTC(a, m - 1, j));
  switch (frequence) {
    case "quotidien":
      d.setUTCDate(d.getUTCDate() + n);
      break;
    case "hebdomadaire":
      d.setUTCDate(d.getUTCDate() + 7 * n);
      break;
    case "mensuel": {
      const cible = new Date(Date.UTC(a, m - 1 + n, 1));
      const dernierJour = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
      return `${cible.getUTCFullYear()}-${String(cible.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(j, dernierJour)).padStart(2, "0")}`;
    }
    case "annuel": {
      const dernierJour = new Date(Date.UTC(a + n, m, 0)).getUTCDate();
      return `${a + n}-${String(m).padStart(2, "0")}-${String(Math.min(j, dernierJour)).padStart(2, "0")}`;
    }
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Dates d'un événement dans [debut, fin] (AAAA-MM-JJ, bornes incluses). Un
 * événement non récurrent renvoie sa date si elle est dans la plage.
 */
export function datesDansPlage(evenement: Recurrent, debut: string, fin: string): string[] {
  const { date, recurrence_frequence: frequence, recurrence_fin: finRecurrence } = evenement;
  if (!frequence) return date >= debut && date <= fin ? [date] : [];
  const limite = finRecurrence && finRecurrence < fin ? finRecurrence : fin;
  const dates: string[] = [];
  // Garde-fou : 5 ans de récurrence quotidienne au plus.
  for (let n = 0; n < 1830; n++) {
    const d = ajouterPeriodes(date, frequence, n);
    if (d > limite) break;
    if (d >= debut) dates.push(d);
  }
  return dates;
}

/** Duplique chaque événement récurrent en une occurrence par date de la plage. */
export function etendreOccurrences<T extends Recurrent>(
  evenements: T[],
  debut: string,
  fin: string
): (T & { dateOrigine: string })[] {
  const occurrences: (T & { dateOrigine: string })[] = [];
  for (const e of evenements) {
    for (const d of datesDansPlage(e, debut, fin)) {
      occurrences.push({ ...e, date: d, dateOrigine: e.date });
    }
  }
  return occurrences;
}
