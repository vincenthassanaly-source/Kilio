import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getResumeNutritionJour } from "@/app/actions/journal";
import { DashboardNutritionSection } from "./DashboardNutritionSection";
import { getToday } from "./today";

// Server Component async indépendant : ne précharge que la query nutrition
// (voir reports/2026-09-04-dashboard-streaming-par-section.md). Le
// <Suspense> englobant dans DashboardView.tsx laisse cette section
// apparaître dès que sa requête est prête, sans attendre les autres cartes.
export async function DashboardNutritionCard() {
  const today = await getToday();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.resumeNutrition(today),
    // Le planning hebdomadaire d'entraînement décide de la cible comparée.
    queryFn: () => getResumeNutritionJour(today),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardNutritionSection today={today} />
    </HydrationBoundary>
  );
}
