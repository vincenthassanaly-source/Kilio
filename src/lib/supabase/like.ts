/**
 * Échappe `\`, `%` et `_` pour que la saisie soit cherchée telle quelle dans
 * un motif `ilike` (sinon « 50% » ou « a_b » matchent bien plus large).
 */
export function echapperLike(valeur: string): string {
  return valeur.replace(/[\\%_]/g, "\\$&");
}

/** Motif `ilike` « contient » pour une saisie utilisateur. */
export function motifContient(saisie: string): string {
  return `%${echapperLike(saisie)}%`;
}

/**
 * Valeur entre guillemets pour un filtre `.or("col.ilike.<valeur>,...")` :
 * hors guillemets, une virgule ou une parenthèse de la saisie couperait le
 * filtre et permettrait d'y injecter des conditions.
 */
export function guillemetsPostgrest(valeur: string): string {
  return `"${valeur.replace(/[\\"]/g, "\\$&")}"`;
}
