import { shiftDate } from "@/lib/date/iso";

// Le streak se calcule côté serveur (JS, pas SQL récursif) : on remonte
// jour par jour depuis `date` tant que la valeur de l'entrée est > 0, et on
// s'arrête au premier jour manquant ou nul. Choix documenté dans le rapport.
export function calculerStreak(entriesParDate: Map<string, number>, date: string): number {
  let streak = 0;
  let jour = date;

  while (true) {
    const valeur = entriesParDate.get(jour);
    if (!valeur || valeur <= 0) break;
    streak += 1;
    jour = shiftDate(jour, -1);
  }

  return streak;
}

// --- Fréquence hebdomadaire ---

// Lundi de la semaine contenant `date` (semaines ISO, lundi-dimanche).
export function lundiDe(date: string): string {
  const jourSemaine = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = dimanche
  return shiftDate(date, -((jourSemaine + 6) % 7));
}

export type HabitudeCalcul = {
  type: "boolean" | "streak" | "quantifiee";
  valeur_cible: number | null;
  frequence_hebdo: number | null;
};

// Une quantifiée avec cible n'est "faite" que si la cible est atteinte ;
// sinon toute valeur > 0 compte.
export function estFait(habitude: HabitudeCalcul, valeur: number | undefined): boolean {
  if (!valeur || valeur <= 0) return false;
  if (habitude.type === "quantifiee" && habitude.valeur_cible) {
    return valeur >= habitude.valeur_cible;
  }
  return true;
}

function joursFaitsParSemaine(
  habitude: HabitudeCalcul,
  entriesParDate: Map<string, number>,
  debut: string,
  fin: string
): Map<string, number> {
  const parSemaine = new Map<string, number>();
  for (const [jour, valeur] of entriesParDate) {
    if (jour < debut || jour > fin || !estFait(habitude, valeur)) continue;
    const lundi = lundiDe(jour);
    parSemaine.set(lundi, (parSemaine.get(lundi) ?? 0) + 1);
  }
  return parSemaine;
}

// Streak d'une habitude "X fois par semaine" : nombre de semaines
// consécutives où l'objectif hebdo est atteint. La semaine en cours compte
// si elle est déjà atteinte, mais ne casse pas la série tant qu'elle est
// encore en cours (on repart alors de la semaine précédente).
export function calculerStreakHebdo(
  habitude: HabitudeCalcul,
  entriesParDate: Map<string, number>,
  date: string
): number {
  const frequence = habitude.frequence_hebdo;
  if (!frequence) return 0;

  const parSemaine = joursFaitsParSemaine(habitude, entriesParDate, "0000-01-01", date);
  let lundi = lundiDe(date);
  let streak = 0;

  if ((parSemaine.get(lundi) ?? 0) >= frequence) streak += 1;
  lundi = shiftDate(lundi, -7);

  while ((parSemaine.get(lundi) ?? 0) >= frequence) {
    streak += 1;
    lundi = shiftDate(lundi, -7);
  }

  return streak;
}

export type ResultatTaux = { faits: number; attendus: number };

function nombreDeJours(debut: string, fin: string): number {
  const ms = new Date(`${fin}T00:00:00Z`).getTime() - new Date(`${debut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000) + 1);
}

// Check réalisés vs attendus sur [debut, fin] (bornes incluses).
// Quotidienne : 1 attendu par jour. Hebdo : frequence * jours / 7, et les
// jours faits sont plafonnés à `frequence` par semaine (un jour de plus que
// prévu ne rattrape pas une autre semaine).
export function calculerTauxReussite(
  habitude: HabitudeCalcul,
  entriesParDate: Map<string, number>,
  debut: string,
  fin: string
): ResultatTaux {
  const jours = nombreDeJours(debut, fin);
  if (jours === 0) return { faits: 0, attendus: 0 };

  const frequence = habitude.frequence_hebdo;
  const parSemaine = joursFaitsParSemaine(habitude, entriesParDate, debut, fin);

  if (!frequence) {
    let faits = 0;
    for (const n of parSemaine.values()) faits += n;
    return { faits, attendus: jours };
  }

  let faits = 0;
  for (const n of parSemaine.values()) faits += Math.min(n, frequence);
  return { faits, attendus: (frequence * jours) / 7 };
}
