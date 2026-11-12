/**
 * Brouillon de la saisie clavier du Journal, gardé EN MÉMOIRE seulement (variable de module).
 *
 * Il survit au démontage de `SaisieClavier` : bascule Stylo/Clavier, ou reverrouillage du Journal
 * (qui démonte tout le contenu sous le verrou), tant que l'onglet n'est pas rechargé. Il n'est
 * jamais écrit dans localStorage / sessionStorage / IndexedDB : le Journal est un carnet intime
 * protégé par passkey, un texte lisible dans le stockage du navigateur contournerait ce verrou.
 *
 * Un seul brouillon, rattaché à un jour (`AAAA-MM-JJ`) : changer de jour ne reprend pas le texte
 * d'un autre jour.
 */
let brouillon: { jour: string; texte: string } | null = null;

export function lireBrouillon(jour: string): string {
  return brouillon && brouillon.jour === jour ? brouillon.texte : "";
}

export function ecrireBrouillon(jour: string, texte: string): void {
  brouillon = texte === "" ? null : { jour, texte };
}

/** Pour les tests : repart d'un état vide. */
export function oublierBrouillons(): void {
  brouillon = null;
}
