const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vrai si `valeur` a la forme d'un UUID (id venu d'un client, donc non fiable). */
export function estUuid(valeur: string): boolean {
  return UUID_REGEX.test(valeur);
}
