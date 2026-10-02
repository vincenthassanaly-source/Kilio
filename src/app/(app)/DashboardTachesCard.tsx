import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getTachesAvecRelationsEnCache } from "@/lib/taches/cache";
import { DashboardTachesSection } from "./DashboardTachesSection";
import { getToday } from "./today";

// Server Component async indépendant : ne précharge que la query `taches`,
// partagée par les cartes "Aujourd'hui" et "Prochain événement" (un seul
// fetch pour les deux). Voir reports/2026-09-04-dashboard-streaming-par-section.md.
export async function DashboardTachesCard() {
  const today = await getToday();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.taches, queryFn: getTachesAvecRelationsEnCache });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardTachesSection today={today} />
    </HydrationBoundary>
  );
}
