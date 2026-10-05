import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { Enums } from "@/lib/supabase/types";
import { aujourdhuiParis } from "@/lib/date/paris";

export const FREQUENCE_LABELS: Record<Enums<"frequence_recurrence">, string> = {
  quotidien: "Quotidien",
  hebdomadaire: "Hebdomadaire",
  mensuel: "Mensuel",
  annuel: "Annuel",
};

// Date du jour à Paris (T3) : gardée sous ce nom pour ses nombreux appelants
// (Tâches), côté serveur comme côté client.
export function aujourdhuiISO(): string {
  return aujourdhuiParis();
}

/**
 * Calcule la prochaine occurrence d'une récurrence à partir
 * d'une date ISO ("YYYY-MM-DD") et de sa fréquence.
 *
 * Décision de calage fin de mois / année (documentée plutôt que laissée
 * implicite) : on reprend tel quel le comportement de `date-fns`
 * (`addMonths`/`addYears`), qui cale sur le dernier jour du mois cible quand
 * le jour d'origine n'y existe pas — ex. 31 janvier + 1 mois → 28 (ou 29)
 * février, 29 février + 1 an → 28 février une année non bissextile.
 *
 * Les composants année/mois/jour sont extraits et reconstruits en date
 * locale (jamais via `toISOString`, qui convertit en UTC et peut décaler
 * la date d'un jour selon le fuseau du serveur) : le calcul de calendrier
 * reste correct quel que soit le fuseau du processus qui l'exécute.
 */
export function calculerProchaineOccurrence(
  dateISO: string,
  frequence: Enums<"frequence_recurrence">
): string {
  const [annee, mois, jour] = dateISO.split("-").map(Number);
  const date = new Date(annee, mois - 1, jour);

  const suivante = (() => {
    switch (frequence) {
      case "quotidien":
        return addDays(date, 1);
      case "hebdomadaire":
        return addWeeks(date, 1);
      case "mensuel":
        return addMonths(date, 1);
      case "annuel":
        return addYears(date, 1);
    }
  })();

  const anneeSuivante = suivante.getFullYear();
  const moisSuivant = String(suivante.getMonth() + 1).padStart(2, "0");
  const jourSuivant = String(suivante.getDate()).padStart(2, "0");
  return `${anneeSuivante}-${moisSuivant}-${jourSuivant}`;
}
