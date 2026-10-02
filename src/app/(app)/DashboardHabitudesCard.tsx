import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getHabitudesDuJourEnCache } from "@/lib/habitudes/cache";
import { DashboardHabitudesSection } from "./DashboardHabitudesSection";
import { getToday } from "./today";

// Server Component async indépendant : ne précharge que la query
// habitudes du jour. Voir reports/2026-09-04-dashboard-streaming-par-section.md.
export async function DashboardHabitudesCard() {
  const today = await getToday();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.habitudes(today), queryFn: () => getHabitudesDuJourEnCache(today) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardHabitudesSection today={today} />
    </HydrationBoundary>
  );
}
