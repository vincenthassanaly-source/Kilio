"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

async function lireNombreInbox(): Promise<number> {
  const reponse = await fetch("/api/inbox/count", { cache: "no-store" });
  if (!reponse.ok) throw new Error("Compteur inbox illisible");
  const { count } = (await reponse.json()) as { count: number };
  return count;
}

/**
 * Nombre de captures à trier, pour les pastilles (« Plus », « + »). Lecture
 * client pure par une route GET (voir /api/inbox/count) : la barre du bas est
 * en cache statique, elle ne peut pas porter de donnée serveur. En cas d'échec
 * (hors ligne, serveur), 0 : pas de pastille.
 */
export function useInboxCount(): number {
  const { data } = useQuery({
    queryKey: queryKeys.inboxCount,
    queryFn: lireNombreInbox,
    staleTime: 30_000,
    retry: false,
  });
  return data ?? 0;
}
