import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Annule l'effet optimiste d'UNE mutation sur une liste en cache : remet
 * l'élément `id` dans l'état qu'il avait dans `avant` (réinsère-le s'il a été
 * retiré). Restaurer toute la liste écraserait les mises à jour optimistes
 * d'autres éléments faites pendant ce temps (deux coches rapprochées dont une
 * seule échoue).
 */
export function restaurerElement<T extends { id: string }>(
  queryClient: QueryClient,
  key: QueryKey,
  avant: T[] | undefined,
  id: string
) {
  if (!avant) return;
  const elementAvant = avant.find((e) => e.id === id);
  queryClient.setQueryData<T[]>(key, (courant) => {
    if (!courant) return avant;
    if (!elementAvant) return courant.filter((e) => e.id !== id);
    if (courant.some((e) => e.id === id)) return courant.map((e) => (e.id === id ? elementAvant : e));
    const copie = [...courant];
    copie.splice(Math.min(avant.indexOf(elementAvant), copie.length), 0, elementAvant);
    return copie;
  });
}
