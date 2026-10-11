/**
 * Écrans plein focus où la barre de navigation du bas est masquée : elle
 * entrerait en collision avec les contrôles fixes de l'écran (ex. la barre de
 * repos de la séance en direct) et gaspillerait de la hauteur utile pendant
 * l'effort. L'écran fournit lui-même sa sortie (« Quitter », retour système).
 */
const ECRANS_IMMERSIFS: readonly string[] = ["/musculation/seance"];

export function barreBasseMasquee(pathname: string): boolean {
  const chemin = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ECRANS_IMMERSIFS.includes(chemin);
}
