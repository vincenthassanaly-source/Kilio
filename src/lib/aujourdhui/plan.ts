import { dureeTotale, enHeure, enMinutes, type Plage } from "@/lib/programme/disponibilites";
import { DUREE_PLANIFICATION_PAR_DEFAUT } from "./compute";

// Plan du jour proposé : logique pure et déterministe (aucune IA). On prend les
// tâches à faire aujourd'hui (en retard, ou du jour sans heure), on les classe
// (priorité, puis retard le plus ancien), et on les range dans les trous libres
// de la frise, au plus tôt. L'utilisateur valide ; rien n'est planifié ici.

const NB_MAX_PROPOSITIONS = 5;

type Priorite = "haute" | "moyenne" | "basse" | "aucune";
const RANG_PRIORITE: Record<Priorite, number> = { haute: 0, moyenne: 1, basse: 2, aucune: 3 };

export type TachePlanifiable = {
  id: string;
  fait: boolean;
  echeance: string | null;
  heure: string | null;
  toute_la_journee: boolean;
  priorite: Priorite;
  duree_minutes: number | null;
};

export type Proposition<T> = { tache: T; creneau: Plage; dureeMinutes: number };

export type PlanDuJour<T> = {
  propositions: Proposition<T>[];
  // Candidates qui ne tiennent dans aucun trou libre (ou au-delà du plafond).
  nonPlacees: T[];
  // Pour dire « 3 h estimées pour 2 h libres » sans calcul côté écran.
  minutesDemandees: number;
  minutesLibres: number;
};

function dureeDe(t: TachePlanifiable): number {
  return t.duree_minutes ?? DUREE_PLANIFICATION_PAR_DEFAUT;
}

/**
 * Tâches à caser aujourd'hui : en retard (même horodatées : on les replanifie),
 * ou du jour sans heure. Les tâches « toute la journée » n'ont pas à être
 * horodatées. Classées par priorité, puis échéance (retard le plus ancien d'abord).
 */
export function candidatesPlanDuJour<T extends TachePlanifiable>(taches: readonly T[], today: string): T[] {
  return taches
    .filter((t) => {
      if (t.fait || t.toute_la_journee || t.echeance === null) return false;
      if (t.echeance < today) return true;
      return t.echeance === today && t.heure === null;
    })
    .sort(
      (a, b) =>
        RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite] ||
        (a.echeance! < b.echeance! ? -1 : a.echeance! > b.echeance! ? 1 : 0)
    );
}

export function construirePlanDuJour<T extends TachePlanifiable>(
  taches: readonly T[],
  libres: readonly Plage[],
  today: string,
  max = NB_MAX_PROPOSITIONS
): PlanDuJour<T> {
  const candidates = candidatesPlanDuJour(taches, today);
  // Copie de travail : chaque tâche placée consomme le début de son trou.
  const trous = libres.map((p) => ({ debut: enMinutes(p.debut), fin: enMinutes(p.fin) }));
  const propositions: Proposition<T>[] = [];
  const nonPlacees: T[] = [];

  for (const tache of candidates) {
    const duree = dureeDe(tache);
    const trou = propositions.length < max ? trous.find((p) => p.fin - p.debut >= duree) : undefined;
    if (!trou) {
      nonPlacees.push(tache);
      continue;
    }
    propositions.push({
      tache,
      creneau: { debut: enHeure(trou.debut), fin: enHeure(trou.debut + duree) },
      dureeMinutes: duree,
    });
    trou.debut += duree;
  }

  return {
    propositions,
    nonPlacees,
    minutesDemandees: candidates.reduce((somme, t) => somme + dureeDe(t), 0),
    minutesLibres: dureeTotale([...libres]),
  };
}
