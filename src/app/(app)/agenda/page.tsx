import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getTags } from "@/app/actions/taches";
import { getListesEnCache, getTachesAvecRelationsEnCache } from "@/lib/taches/cache";
import { getPlanningTravail, getPlanningTravailExceptions } from "@/app/actions/planning-travail";
import { AgendaView } from "./AgendaView";
import { screenTitle } from "@/lib/ui";

// Shell serveur : tâches/listes/tags/planning sont préchargés ici côté
// serveur (TanStack Query) puis hydratés côté client dans AgendaView, qui
// lit le cache déjà chaud via ses useQuery (voir /taches, même patron, et
// DashboardTachesCard.tsx pour le patron d'origine). La clé
// `queryKeys.taches` est réutilisée telle quelle (partagée avec /taches et
// le dashboard) : cocher une tâche depuis l'agenda met donc à jour /taches
// instantanément et inversement, sans wiring supplémentaire.

export default async function AgendaPage() {
  await connection();
  const queryClient = makeServerQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: queryKeys.taches, queryFn: getTachesAvecRelationsEnCache }),
    queryClient.prefetchQuery({ queryKey: queryKeys.listes, queryFn: getListesEnCache }),
    queryClient.prefetchQuery({ queryKey: queryKeys.tags, queryFn: getTags }),
    queryClient.prefetchQuery({ queryKey: queryKeys.planningTravail, queryFn: getPlanningTravail }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.planningTravailExceptions,
      queryFn: getPlanningTravailExceptions,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Agenda</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AgendaView />
      </HydrationBoundary>
    </div>
  );
}
