import type { ActionResult } from "@/lib/actions/result";

/** Déballe le résultat d'une Server Action de lecture pour TanStack Query : un échec
 * devient une erreur dont le message (déjà rédigé en français côté serveur) s'affiche tel quel. */
export async function lireResultat<T>(resultat: Promise<ActionResult<T>>): Promise<T> {
  const r = await resultat;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
