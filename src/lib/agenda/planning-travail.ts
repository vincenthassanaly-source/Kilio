import { differenceInCalendarWeeks, getDay } from "date-fns";
import type { Tables } from "@/lib/supabase/types";
import { parseISODate, toISODate } from "@/lib/date/iso";

// Forme minimale commune aux créneaux récurrents (horaires_travail_creneaux)
// et aux exceptions ponctuelles (horaires_travail_exceptions) une fois
// résolus pour un jour donné : les consommateurs (WorkHoursBand, calcul du
// scroll initial…) n'ont besoin que de heure_debut/heure_fin, peu importe
// l'origine du créneau.
export type CreneauDuJour = {
  id: number;
  heure_debut: string;
  heure_fin: string;
};

// Un créneau "une_semaine_sur_deux" est actif une semaine sur deux, en
// parité avec sa semaine de référence : on compare le lundi de la semaine
// de `date` à celui de la semaine de référence (weekStartsOn: 1, cohérent
// avec le reste de l'Agenda), un écart pair signifiant "même parité".
function estSemaineTravaillee(date: Date, semaineReference: Date): boolean {
  const diff = differenceInCalendarWeeks(date, semaineReference, { weekStartsOn: 1 });
  return Math.abs(diff) % 2 === 0;
}

// Fusionne les créneaux récurrents applicables au jour demandé avec les
// exceptions ponctuelles tombant exactement sur ce jour (`exceptions` est
// optionnel pour ne pas casser les appels existants qui n'en ont pas
// encore).
export function getCreneauxDuJour(
  creneaux: Tables<"horaires_travail_creneaux">[],
  date: Date,
  exceptions: Tables<"horaires_travail_exceptions">[] = []
): CreneauDuJour[] {
  const jour = getDay(date);
  const recurrents = creneaux.filter((creneau) => {
    if (creneau.jour_semaine !== jour) return false;
    if (creneau.frequence === "toutes_les_semaines") return true;
    if (!creneau.semaine_reference) return false;
    return estSemaineTravaillee(date, parseISODate(creneau.semaine_reference));
  });

  const dateISO = toISODate(date);
  const exceptionsDuJour = exceptions.filter((exception) => exception.date === dateISO);

  return [...recurrents, ...exceptionsDuJour];
}
