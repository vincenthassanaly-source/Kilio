import { differenceInCalendarDays } from "date-fns";
import { getBlocInterval } from "@/lib/agenda/compute";
import { heureToMinutes } from "@/app/(app)/agenda/date-utils";
import { enHeure, plagesLibres, type Plage } from "@/lib/programme/disponibilites";
import { parseISODate } from "@/lib/date/iso";
import type { CreneauDuJour } from "@/lib/agenda/planning-travail";

// Logique pure de l'écran « Aujourd'hui » : retard, repas restants, trous
// libres de la frise. Aucune dépendance React ni réseau.

type AvecEcheance = { echeance: string | null; fait: boolean; heure: string | null };

/** Tâches non faites dont l'échéance est passée, la plus ancienne d'abord. */
export function tachesEnRetard<T extends AvecEcheance>(taches: readonly T[], today: string): T[] {
  return taches
    .filter((t) => !t.fait && t.echeance !== null && t.echeance < today)
    .sort((a, b) => (a.echeance! < b.echeance! ? -1 : a.echeance! > b.echeance! ? 1 : (a.heure ?? "").localeCompare(b.heure ?? "")));
}

/** Tâches du jour (faites ou non), avec heure d'abord, puis sans heure. */
export function tachesDuJour<T extends AvecEcheance>(taches: readonly T[], today: string): T[] {
  return taches
    .filter((t) => t.echeance === today)
    .sort((a, b) => (a.heure ?? "99:99").localeCompare(b.heure ?? "99:99"));
}

/** « hier », « il y a 3 j » : retard d'une échéance passée. */
export function libelleRetard(echeance: string, today: string): string {
  const jours = differenceInCalendarDays(parseISODate(today), parseISODate(echeance));
  if (jours <= 1) return "hier";
  return `il y a ${jours} j`;
}

export type Restant = { valeur: number; depasse: boolean };

export type RepasRestants = {
  kcal: Restant;
  proteines: Restant;
  glucides: Restant;
  lipides: Restant;
};

function restant(cible: number, consomme: number): Restant {
  const reste = Math.round(cible - consomme);
  return { valeur: Math.abs(reste), depasse: reste < 0 };
}

/**
 * Ce qu'il reste à manger aujourd'hui (kcal et macros) par rapport à la cible
 * du type de jour. `null` sans objectif : on ne fabrique jamais de cible
 * (même règle que la carte Nutrition de l'accueil).
 */
export function repasRestants(
  consomme: { kcal: number; proteines: number; glucides: number; lipides: number },
  kcalGoal: number | null,
  macroGoals: { proteines: number; glucides: number; lipides: number } | null
): RepasRestants | null {
  if (kcalGoal === null || macroGoals === null) return null;
  return {
    kcal: restant(kcalGoal, consomme.kcal),
    proteines: restant(macroGoals.proteines, consomme.proteines),
    glucides: restant(macroGoals.glucides, consomme.glucides),
    lipides: restant(macroGoals.lipides, consomme.lipides),
  };
}

type Plageable = { heure: string | null; heure_fin: string | null };

/**
 * Plages libres de la frise : entre maintenant et la fin de journée, une fois
 * retirés les créneaux de travail et les blocs horodatés. Les bornes des blocs
 * sont celles que la grille dessine (`getBlocInterval`, 30 min par défaut sans
 * heure de fin) pour que le trou affiché ne contredise jamais la frise.
 */
export function plagesLibresDuJour(input: {
  maintenant: string;
  creneauxTravail: Pick<CreneauDuJour, "heure_debut" | "heure_fin">[];
  blocs: Plageable[];
  dureeMin?: number;
}): Plage[] {
  const occupations: Plage[] = [];
  for (const c of input.creneauxTravail) {
    const debut = heureToMinutes(c.heure_debut);
    const fin = heureToMinutes(c.heure_fin);
    if (debut === null || fin === null) continue;
    occupations.push({ debut: enHeure(debut), fin: fin > debut ? enHeure(fin) : "24:00" });
  }
  for (const bloc of input.blocs) {
    const intervalle = getBlocInterval(bloc);
    if (!intervalle) continue;
    occupations.push({
      debut: enHeure(intervalle.start),
      fin: intervalle.end >= 24 * 60 ? "24:00" : enHeure(intervalle.end),
    });
  }
  return plagesLibres({ maintenant: input.maintenant, occupations, dureeMin: input.dureeMin });
}
