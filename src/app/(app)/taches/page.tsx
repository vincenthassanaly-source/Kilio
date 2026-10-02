import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getTags } from "@/app/actions/taches";
import { getListesEnCache, getTachesAvecRelationsEnCache } from "@/lib/taches/cache";
import { TachesView } from "./TachesView";
import { screenTitle } from "@/lib/ui";

// Le shell (titre) reste rendu instantanément côté serveur ; les données
// (tâches/listes/tags) sont préchargées ici côté serveur (TanStack Query) et
// hydratées côté client dans TachesView, qui lit le cache déjà chaud via ses
// useQuery — voir 2.2 du prompt de session (reports/2026-09-02-fluidite-ux-globale.md
// pour le détail) et le pattern déjà en place dans DashboardTachesCard.tsx.
export default async function TachesPage() {
  await connection();
  const queryClient = makeServerQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: queryKeys.taches, queryFn: getTachesAvecRelationsEnCache }),
    queryClient.prefetchQuery({ queryKey: queryKeys.listes, queryFn: getListesEnCache }),
    queryClient.prefetchQuery({ queryKey: queryKeys.tags, queryFn: getTags }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle} style={{ viewTransitionName: "taches-titre-dashboard" }}>
        Tâches
      </h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TachesView />
      </HydrationBoundary>
    </div>
  );
}
