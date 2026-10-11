// Jours libres : 2 jetons par semaine (lundi → dimanche) qui suspendent la
// limite kcal d'une date. On les pose le jour même ou la veille, jamais après
// coup : le but est de décider avant ou pendant, pas de « régulariser » un
// dépassement le lendemain. Fonctions pures.
import { shiftDate } from "@/lib/date/iso";
import { semaineDe } from "@/lib/seances/compute";

export const JETONS_PAR_SEMAINE = 2;

/** Jours libres déjà posés dans la semaine (lundi → dimanche) qui contient `date`. */
export function joursLibresDeLaSemaine(joursLibres: readonly string[], date: string): string[] {
  const { debut, fin } = semaineDe(date);
  return joursLibres.filter((jour) => jour >= debut && jour <= fin);
}

/** Jetons encore disponibles dans la semaine de `date`. */
export function jetonsRestants(joursLibres: readonly string[], date: string): number {
  return Math.max(0, JETONS_PAR_SEMAINE - joursLibresDeLaSemaine(joursLibres, date).length);
}

/** Pourquoi `date` ne peut pas devenir un jour libre, ou `null` si c'est possible. */
export function erreurPoseJourLibre(date: string, today: string, joursLibres: readonly string[]): string | null {
  if (date !== today && date !== shiftDate(today, 1)) {
    return "Un jour libre se pose le jour même ou la veille.";
  }
  if (joursLibres.includes(date)) return "Ce jour est déjà un jour libre.";
  if (jetonsRestants(joursLibres, date) === 0) {
    return `Tu as déjà posé tes ${JETONS_PAR_SEMAINE} jours libres cette semaine.`;
  }
  return null;
}

/** Un jour libre peut être retiré tant qu'il n'est pas passé. */
export function peutRetirerJourLibre(date: string, today: string): boolean {
  return date >= today;
}

/** Bornes de lecture des jours libres utiles à l'écran Aujourd'hui : la semaine
 * en cours, plus celle de demain si elle commence demain (dimanche → lundi). */
export function plageJoursLibres(today: string): { debut: string; fin: string } {
  return { debut: semaineDe(today).debut, fin: semaineDe(shiftDate(today, 1)).fin };
}
