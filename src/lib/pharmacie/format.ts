import type { EtatCarte } from "./srs";

// Délai avant le prochain passage, affiché sous chaque bouton de note.
export function formaterDelai(etat: Pick<EtatCarte, "intervalle_jours">): string {
  const j = etat.intervalle_jours;
  if (j <= 0) return "10 min";
  if (j < 30) return `${j} j`;
  const mois = Math.round(j / 30);
  return mois < 12 ? `${mois} mois` : "1 an";
}

export function pourcentage(partie: number, total: number): number {
  return total === 0 ? 0 : Math.round((partie / total) * 100);
}

export function pluriel(n: number, singulier: string, plur = `${singulier}s`): string {
  return `${n} ${n > 1 ? plur : singulier}`;
}
