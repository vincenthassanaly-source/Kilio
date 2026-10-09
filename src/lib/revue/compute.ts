import { dureeEvenement } from "@/lib/evenements/compute";
import { shiftDate } from "@/lib/date/iso";

// Logique pure de la revue hebdomadaire : bilan des 7 derniers jours et
// aperçu des 7 prochains. Aucune dépendance React ni réseau.

/** Durée supposée d'une tâche sans estimation (même valeur que le plan du jour). */
const DUREE_TACHE_PAR_DEFAUT = 30;
/** Au-delà, un jour est signalé « chargé » (rendez-vous + tâches estimées). */
const SEUIL_JOUR_CHARGE_MINUTES = 6 * 60;

type TacheRevue = {
  id: string;
  fait: boolean;
  termine_le: string | null;
  echeance: string | null;
  duree_minutes: number | null;
};

type EvenementRevue = {
  date: string;
  heure: string;
  heure_fin: string;
  toute_la_journee: boolean;
};

const formatParis = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" });

/** Date calendaire (AAAA-MM-JJ) à Paris d'un instant ISO. */
export function dateParisDe(iso: string): string {
  return formatParis.format(new Date(iso));
}

export type BilanSemaine<T> = {
  /** Tâches terminées sur les 7 derniers jours (aujourd'hui compris), récentes d'abord. */
  terminees: T[];
  nbEnRetard: number;
};

export function bilanSemaine<T extends TacheRevue>(taches: readonly T[], today: string): BilanSemaine<T> {
  const debut = shiftDate(today, -6);
  const terminees = taches
    .filter((t) => {
      if (!t.fait || !t.termine_le) return false;
      const jour = dateParisDe(t.termine_le);
      return jour >= debut && jour <= today;
    })
    .sort((a, b) => b.termine_le!.localeCompare(a.termine_le!));
  const nbEnRetard = taches.filter((t) => !t.fait && t.echeance !== null && t.echeance < today).length;
  return { terminees, nbEnRetard };
}

function minutesEvenement(e: EvenementRevue): number {
  if (e.toute_la_journee) return 0;
  return dureeEvenement(e.heure, e.heure_fin) ?? 0;
}

export type JourSemaine<T, E> = {
  date: string;
  taches: T[];
  evenements: E[];
  minutesTaches: number;
  minutesEvenements: number;
  charge: boolean;
};

/** Les 7 jours qui suivent `today` : tâches échues, événements, charge estimée. */
export function semaineProchaine<T extends TacheRevue, E extends EvenementRevue>(
  taches: readonly T[],
  evenements: readonly E[],
  today: string
): JourSemaine<T, E>[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(today, i + 1);
    const tachesDuJour = taches.filter((t) => !t.fait && t.echeance === date);
    const evenementsDuJour = evenements
      .filter((e) => e.date === date)
      .sort((a, b) => a.heure.localeCompare(b.heure));
    const minutesTaches = tachesDuJour.reduce((s, t) => s + (t.duree_minutes ?? DUREE_TACHE_PAR_DEFAUT), 0);
    const minutesEvenements = evenementsDuJour.reduce((s, e) => s + minutesEvenement(e), 0);
    return {
      date,
      taches: tachesDuJour,
      evenements: evenementsDuJour,
      minutesTaches,
      minutesEvenements,
      charge: minutesTaches + minutesEvenements >= SEUIL_JOUR_CHARGE_MINUTES,
    };
  });
}

/** Tâches actives sans échéance : à dater ou à abandonner pendant la revue. */
export function nbSansDate(taches: readonly TacheRevue[]): number {
  return taches.filter((t) => !t.fait && t.echeance === null).length;
}
