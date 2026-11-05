const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vrai si `valeur` a la forme d'un UUID (id venu d'un client, donc non fiable).
 * Accepte aussi `unknown` (type guard) pour valider une entrée non typée.
 */
export function estUuid(valeur: string): boolean;
export function estUuid(valeur: unknown): valeur is string;
export function estUuid(valeur: unknown): boolean {
  return typeof valeur === "string" && UUID_REGEX.test(valeur);
}
