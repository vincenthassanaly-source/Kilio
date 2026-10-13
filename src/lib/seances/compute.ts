// Séances de sport de la semaine (Push / Pull / Legs) : fonctions pures (aucun
// accès réseau), partagées par les Server Actions, le bilan et l'écran
// Aujourd'hui. La semaine va du lundi au dimanche. Aucune date ni heure par
// séance : « faite cette semaine » se déduit des entraînements enregistrés.
import { shiftDate } from "@/lib/date/iso";

/** Types de séance (liste fermée, doublée par une contrainte SQL). */
export const TYPES_SEANCE = ["LEGS", "PUSH", "PULL"] as const;
export type TypeSeance = (typeof TYPES_SEANCE)[number];

export function estTypeSeance(valeur: string): valeur is TypeSeance {
  return (TYPES_SEANCE as readonly string[]).includes(valeur);
}

/** Ordre d'affichage des types sur la carte d'Aujourd'hui. */
export const ORDRE_TYPES: readonly TypeSeance[] = ["PUSH", "PULL", "LEGS"];

export const LIBELLES_TYPE: Record<TypeSeance, string> = { PUSH: "Push", PULL: "Pull", LEGS: "Legs" };

/** Jour de la semaine (0 = dimanche … 6 = samedi) d'une date AAAA-MM-JJ. */
export function jourDeSemaine(date: string): number {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
}

/** Bornes (lundi → dimanche) de la semaine qui contient `date`. */
export function semaineDe(date: string): { debut: string; fin: string } {
  const ecartLundi = (jourDeSemaine(date) + 6) % 7;
  const debut = shiftDate(date, -ecartLundi);
  return { debut, fin: shiftDate(debut, 6) };
}

/** Routine rattachée à un type de séance. */
export type RoutineSemaine = { id: string; nom: string; type: TypeSeance; nbExercices: number };

/** Entraînement enregistré : sa routine, son type (séance libre) et son jour. */
export type EntrainementSemaine = { routine_id: string | null; type_seance: string | null; date: string };

export type PastilleRoutine = { id: string; nom: string; pastille: string; nbExercices: number; faite: boolean };
export type GroupeSemaine = { type: TypeSeance; faite: boolean; routines: PastilleRoutine[] };
export type SemaineSeances = { groupes: GroupeSemaine[] };

/** « Legs A » → « A » : le nom de la routine sans le mot du type (nom entier s'il n'en reste rien). */
export function libellePastille(nom: string, type: TypeSeance): string {
  const reste = nom.trim().replace(new RegExp(`^${LIBELLES_TYPE[type]}\\s*`, "i"), "").trim();
  return reste || nom.trim();
}

/**
 * Trois groupes (Push, Pull, Legs), chacun avec les pastilles de ses routines.
 * Une pastille est cochée si un entraînement de la semaine suit cette routine ;
 * un type est fait si un entraînement de la semaine lui est rattaché : par le
 * type enregistré (choisi à la fin d'une séance libre, ou copié de la routine)
 * ou, à défaut, par sa routine.
 */
export function composerSemaine(
  routines: readonly RoutineSemaine[],
  entrainements: readonly EntrainementSemaine[]
): SemaineSeances {
  const typeDeRoutine = new Map(routines.map((r) => [r.id, r.type]));
  const routinesFaites = new Set<string>();
  const typesFaits = new Set<TypeSeance>();

  for (const e of entrainements) {
    if (e.routine_id) routinesFaites.add(e.routine_id);
    const type =
      e.type_seance && estTypeSeance(e.type_seance) ? e.type_seance : e.routine_id ? typeDeRoutine.get(e.routine_id) : undefined;
    if (type) typesFaits.add(type);
  }

  return {
    groupes: ORDRE_TYPES.map((type) => ({
      type,
      faite: typesFaits.has(type),
      routines: routines
        .filter((r) => r.type === type)
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { numeric: true }))
        .map((r) => ({
          id: r.id,
          nom: r.nom,
          pastille: libellePastille(r.nom, type),
          nbExercices: r.nbExercices,
          faite: routinesFaites.has(r.id),
        })),
    })),
  };
}

/** Avancement de la semaine : « 1/3 » types faits. */
export function progressionSemaine(groupes: readonly Pick<GroupeSemaine, "faite">[]): { faites: number; total: number } {
  return { faites: groupes.filter((g) => g.faite).length, total: groupes.length };
}
