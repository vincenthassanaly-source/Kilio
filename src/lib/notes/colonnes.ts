/**
 * Répartit des éléments en `n` colonnes dans l'ordre de lecture ligne par
 * ligne : 1 et 2 sur la première ligne, 3 et 4 sur la deuxième… La grille CSS
 * `columns-2` remplissait au contraire la colonne de gauche avant celle de
 * droite (1, 2, 3 à gauche, puis 4, 5, 6), si bien que la deuxième note se
 * retrouvait loin sous la première. Chaque colonne garde sa hauteur libre
 * (effet maçonnerie conservé).
 */
export function repartirEnColonnes<T>(elements: readonly T[], n = 2): T[][] {
  const colonnes: T[][] = Array.from({ length: Math.max(1, n) }, () => []);
  elements.forEach((element, index) => colonnes[index % colonnes.length].push(element));
  return colonnes;
}
