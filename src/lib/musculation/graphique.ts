// Calculs d'échelle du graphique de progression (aucun rendu ici) : graduations
// « rondes » de l'axe vertical et position horizontale proportionnelle au temps,
// pour qu'un mois sans séance se voie sur la courbe.

export type Graduations = { min: number; max: number; ticks: number[] };

/** Pas « rond » (1, 2, 2,5, 5 × 10ⁿ) couvrant `etendue` en environ `cible` intervalles. */
function pasRond(etendue: number, cible: number): number {
  const brut = etendue / cible;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const normalise = brut / puissance;
  const facteur = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 2.5 ? 2.5 : normalise <= 5 ? 5 : 10;
  return facteur * puissance;
}

/**
 * Graduations de l'axe vertical. L'axe ne part pas forcément de zéro (une
 * courbe lit une évolution, pas une longueur) mais s'étend sur des valeurs
 * rondes qui encadrent toutes les données. Une valeur unique reçoit une marge.
 */
export function graduations(valeurs: readonly number[], cible = 4): Graduations {
  if (valeurs.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  let min = Math.min(...valeurs);
  let max = Math.max(...valeurs);
  if (min === max) {
    const marge = Math.max(1, Math.abs(min) * 0.1);
    min -= marge;
    max += marge;
  }
  const pas = pasRond(max - min, cible);
  const bas = Math.floor(min / pas) * pas;
  const haut = Math.ceil(max / pas) * pas;
  const ticks: number[] = [];
  // Arrondi à 6 décimales : évite 0,30000000000000004 dans les libellés.
  for (let v = bas; v <= haut + pas / 1000; v += pas) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

const JOUR_MS = 86_400_000;

function jourUtc(date: string): number {
  const [a, m, j] = date.split("-").map(Number);
  return Date.UTC(a, m - 1, j) / JOUR_MS;
}

/**
 * Position horizontale (0 à 1) de chaque date, proportionnelle au temps. Une
 * seule date, ou plusieurs le même jour, se place au centre.
 */
export function positionsX(dates: readonly string[]): number[] {
  if (dates.length === 0) return [];
  const jours = dates.map(jourUtc);
  const debut = Math.min(...jours);
  const fin = Math.max(...jours);
  if (fin === debut) return jours.map(() => 0.5);
  return jours.map((j) => (j - debut) / (fin - debut));
}
