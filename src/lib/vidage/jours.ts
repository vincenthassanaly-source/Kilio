// Validation des jours (AAAA-MM-JJ) et mois (AAAA-MM) reçus par les actions de
// « Vider ma tête ». Pure : « aujourd'hui » est injectable pour les tests.
import { aujourdhuiParis } from "@/lib/date/paris";
import { shiftDate } from "@/lib/date/iso";

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const MOIS = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Jour réel au bon format, au plus demain (heure de Paris) : la tolérance d'un
 * jour absorbe un téléphone dont l'horloge ou le fuseau est décalé.
 */
export function estJourValide(jour: string, maintenant: Date = new Date()): boolean {
  const m = JOUR.exec(jour);
  if (!m) return false;
  const d = new Date(`${jour}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== jour) return false;
  return jour <= shiftDate(aujourdhuiParis(maintenant), 1);
}

export function estMoisValide(mois: string): boolean {
  return MOIS.test(mois);
}

/** Premier et dernier jour d'un mois AAAA-MM (supposé valide). */
export function premierEtDernierJour(mois: string): [string, string] {
  const [annee, m] = mois.split("-").map(Number);
  const dernier = new Date(Date.UTC(annee, m, 0)).getUTCDate();
  return [`${mois}-01`, `${mois}-${String(dernier).padStart(2, "0")}`];
}
