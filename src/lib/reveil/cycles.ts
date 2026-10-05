// Heures de réveil calées sur la fin d'un cycle de sommeil. Le calcul de
// référence est déterministe (maintenant + délai d'endormissement + N cycles) ;
// c'est Gemini qui le produit à l'écran, et `validerPropositions` vérifie sa
// réponse contre cette référence avant de rien afficher : une heure fausse
// n'atteint jamais l'utilisateur.

export const DUREE_CYCLE_MIN = 90;
export const DELAI_ENDORMISSEMENT_MIN = 15;
/** 4, 5 et 6 cycles : 6 h, 7 h 30 et 9 h de sommeil. */
export const NOMBRES_CYCLES = [4, 5, 6] as const;
/** Meilleur compromis entre durée et fraîcheur au réveil. */
export const CYCLES_RECOMMANDES = 5;

const MINUTES_PAR_JOUR = 24 * 60;

export type Proposition = {
  /** Heure de réveil, « HH:mm ». */
  heure: string;
  cycles: number;
  /** Durée de sommeil effectif (hors délai d'endormissement), en minutes. */
  dureeSommeilMin: number;
};

const FORMAT_HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** « HH:mm » → minutes depuis minuit, ou null si le format est invalide. */
export function minutesDepuisHeure(heure: unknown): number | null {
  if (typeof heure !== "string") return null;
  const m = FORMAT_HEURE.exec(heure.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const FORMAT_HEURE_SOUPLE = /^(\d{1,2})\s*[:hH]\s*(\d{2})$/;

/** Lecture tolérante de la réponse de Gemini : « 5:57 », « 05h57 », « 05:57 ». */
export function minutesDepuisHeureSouple(heure: unknown): number | null {
  if (typeof heure !== "string") return null;
  const m = FORMAT_HEURE_SOUPLE.exec(heure.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

export function heureDepuisMinutes(minutes: number): string {
  const m = ((minutes % MINUTES_PAR_JOUR) + MINUTES_PAR_JOUR) % MINUTES_PAR_JOUR;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Calcul de référence : une proposition par nombre de cycles. */
export function calculerPropositions(heureActuelle: string): Proposition[] {
  const debut = minutesDepuisHeure(heureActuelle);
  if (debut === null) throw new Error(`Heure invalide : ${heureActuelle}`);
  return NOMBRES_CYCLES.map((cycles) => ({
    heure: heureDepuisMinutes(debut + DELAI_ENDORMISSEMENT_MIN + cycles * DUREE_CYCLE_MIN),
    cycles,
    dureeSommeilMin: cycles * DUREE_CYCLE_MIN,
  }));
}

/**
 * Valide la réponse brute de Gemini (`{ propositions: [{ cycles, heure }] }`) :
 * chaque nombre de cycles attendu doit être présent avec exactement l'heure
 * de référence. Renvoie les propositions, ou null si la réponse est fausse,
 * incomplète ou mal formée. Les propositions en plus sont ignorées.
 */
export function validerPropositions(brut: unknown, heureActuelle: string): Proposition[] | null {
  const attendues = calculerPropositions(heureActuelle);
  const liste = (brut as { propositions?: unknown } | null)?.propositions;
  if (!Array.isArray(liste)) return null;

  for (const attendue of attendues) {
    const trouvee = liste.some((p) => {
      if (typeof p !== "object" || p === null) return false;
      const { cycles, heure } = p as { cycles?: unknown; heure?: unknown };
      const minutes = minutesDepuisHeureSouple(heure);
      return cycles === attendue.cycles && minutes !== null && heureDepuisMinutes(minutes) === attendue.heure;
    });
    if (!trouvee) return null;
  }
  return attendues;
}

/** 450 → « 7h30 ». */
export function formaterDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** « 06:57 » → « 6h57 ». */
export function formaterHeure(heure: string): string {
  const minutes = minutesDepuisHeure(heure);
  if (minutes === null) return heure;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}
