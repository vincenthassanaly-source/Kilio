// Séances de sport planifiées : fonctions pures (aucun accès réseau), partagées
// par les Server Actions, la route de report depuis la notification et l'écran
// Aujourd'hui. La semaine va du lundi au dimanche ; `jour_semaine` suit
// Date#getDay (0 = dimanche), comme la revue hebdo.
import { shiftDate } from "@/lib/date/iso";

/** Types de séance proposés (liste fermée, doublée par une contrainte SQL). */
export const TYPES_SEANCE = ["LEGS", "PUSH", "PULL"] as const;
export type TypeSeance = (typeof TYPES_SEANCE)[number];

export function estTypeSeance(valeur: string): valeur is TypeSeance {
  return (TYPES_SEANCE as readonly string[]).includes(valeur);
}

export type Creneau = {
  id: string;
  jour_semaine: number;
  heure: string; // HH:MM[:SS]
  type: string;
  actif: boolean;
};

export type Seance = {
  id: string;
  creneau_id: string | null;
  date_prevue: string;
  date: string;
  heure: string; // HH:MM[:SS]
  type: string;
  statut: "prevue" | "faite";
  reportee: boolean;
};

export type NouvelleSeance = Pick<Seance, "creneau_id" | "date_prevue" | "date" | "heure" | "type">;

export type EtatSeance = "faite" | "aujourdhui" | "a_venir" | "manquee";

export const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
export const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] as const;

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

/** Date du `jourSemaine` (0 = dimanche) dans la semaine qui commence le lundi `debut`. */
export function dateDuJour(debut: string, jourSemaine: number): string {
  return shiftDate(debut, (jourSemaine + 6) % 7);
}

/** « HH:MM » à partir de « HH:MM[:SS] ». */
export function heureCourte(heure: string): string {
  return heure.slice(0, 5);
}

/**
 * Occurrences manquantes de la semaine en cours : une par créneau actif dont le
 * jour n'est pas encore passé, sauf si elle existe déjà (même créneau, même
 * date prévue). Un créneau ajouté en milieu de semaine ne crée donc jamais de
 * séance « manquée » dans le passé.
 */
export function seancesAMaterialiser(
  creneaux: readonly Creneau[],
  existantes: readonly Pick<Seance, "creneau_id" | "date_prevue">[],
  today: string
): NouvelleSeance[] {
  const { debut } = semaineDe(today);
  const connues = new Set(existantes.map((s) => `${s.creneau_id}|${s.date_prevue}`));
  return creneaux
    .filter((c) => c.actif)
    .map((c) => ({ creneau: c, date: dateDuJour(debut, c.jour_semaine) }))
    .filter(({ creneau, date }) => date >= today && !connues.has(`${creneau.id}|${date}`))
    .map(({ creneau, date }) => ({
      creneau_id: creneau.id,
      date_prevue: date,
      date,
      heure: creneau.heure,
      type: creneau.type,
    }));
}

/** Premier jour de `apres` (exclu) à `fin` (inclus) sans aucune séance, ou null. */
export function prochainJourLibre(
  seances: readonly Pick<Seance, "date">[],
  apres: string,
  fin: string
): string | null {
  const occupes = new Set(seances.map((s) => s.date));
  for (let jour = shiftDate(apres, 1); jour <= fin; jour = shiftDate(jour, 1)) {
    if (!occupes.has(jour)) return jour;
  }
  return null;
}

/**
 * Report automatique des séances manquées de la semaine : chacune (une seule
 * fois, tant qu'elle n'a pas déjà été déplacée) est replacée sur le premier
 * jour libre à partir d'aujourd'hui, dans l'ordre où elles ont été manquées.
 * Aujourd'hui n'est candidat que si l'heure de la séance n'est pas passée.
 * Sans jour libre avant dimanche, la séance reste manquée.
 */
export function planReports(
  seances: readonly Seance[],
  today: string,
  maintenant: string, // HH:MM
  fin: string
): { id: string; date: string }[] {
  const manquees = seances
    .filter((s) => s.statut === "prevue" && s.date < today && !s.reportee)
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));
  const occupes = new Set(seances.map((s) => s.date));
  const reports: { id: string; date: string }[] = [];

  for (const seance of manquees) {
    const aujourdhuiPossible = !occupes.has(today) && heureCourte(seance.heure) > maintenant;
    const jour = aujourdhuiPossible ? today : prochainJourLibre([...occupes].map((date) => ({ date })), today, fin);
    if (!jour) continue;
    occupes.add(jour);
    reports.push({ id: seance.id, date: jour });
  }
  return reports;
}

export function etatSeance(seance: Pick<Seance, "statut" | "date">, today: string): EtatSeance {
  if (seance.statut === "faite") return "faite";
  if (seance.date < today) return "manquee";
  return seance.date === today ? "aujourdhui" : "a_venir";
}

export function trierSeances<T extends Pick<Seance, "date" | "heure">>(seances: readonly T[]): T[] {
  return [...seances].sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));
}

/** Avancement de la semaine : « 1/3 faites ». */
export function progressionSemaine(seances: readonly Pick<Seance, "statut">[]): { faites: number; total: number } {
  return { faites: seances.filter((s) => s.statut === "faite").length, total: seances.length };
}
