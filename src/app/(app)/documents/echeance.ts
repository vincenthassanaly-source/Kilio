import { aujourdhuiParis } from "@/lib/date/paris";
// Calcul du badge d'alerte d'échéance, partagé entre la liste et le détail
// d'un document. Les seuils (30/7/1 jours) sont les mêmes que ceux utilisés
// par le cron d'alertes push (src/app/api/cron/echeances-documents/route.ts).
export function formatEcheance(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function joursAvantEcheance(dateEcheance: string): number {
  const aujourdhui = new Date(`${aujourdhuiParis()}T00:00:00`);
  const echeance = new Date(`${dateEcheance}T00:00:00`);
  return Math.round((echeance.getTime() - aujourdhui.getTime()) / (1000 * 60 * 60 * 24));
}

export type NiveauAlerte = "urgent" | "proche" | "aucun";

// "urgent" (≤7 jours, dépassé inclus) et "proche" (≤30 jours) partagent la
// même couleur d'alerte dans l'UI actuelle : le badge affiche simplement
// "moins de 30 jours" dès que ce n'est pas "aucun", mais le niveau distinct
// reste disponible si l'UI veut plus tard différencier l'urgence.
export function niveauAlerte(dateEcheance: string | null): NiveauAlerte {
  if (!dateEcheance) return "aucun";
  const jours = joursAvantEcheance(dateEcheance);
  if (jours <= 7) return "urgent";
  if (jours <= 30) return "proche";
  return "aucun";
}
