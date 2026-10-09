"use client";

import { useQuery } from "@tanstack/react-query";
import { getInboxCount } from "@/app/actions/inbox";
import { queryKeys } from "@/lib/query/keys";

/**
 * Nombre de captures à trier, pour les pastilles (« Plus », « + »). Lecture
 * client pure : la barre du bas est en cache statique, elle ne peut pas
 * porter de donnée serveur. En cas d'échec (hors ligne), 0 : pas de pastille.
 */
export function useInboxCount(): number {
  const { data } = useQuery({
    queryKey: queryKeys.inboxCount,
    queryFn: getInboxCount,
    staleTime: 30_000,
    retry: false,
  });
  return data ?? 0;
}
