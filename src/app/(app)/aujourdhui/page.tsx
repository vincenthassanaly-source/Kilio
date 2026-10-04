import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getEvenements } from "@/app/actions/evenements";
import { getResumeNutritionJour } from "@/app/actions/journal";
import { getPlanningTravail, getPlanningTravailExceptions } from "@/app/actions/planning-travail";
import { getHabitudesDuJourEnCache } from "@/lib/habitudes/cache";
import { queryKeys } from "@/lib/query/keys";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { getTachesAvecRelationsEnCache } from "@/lib/taches/cache";
import { screenTitle } from "@/lib/ui";
import { getToday } from "../today";
import { AujourdhuiView } from "./AujourdhuiView";

// Shell serveur : tout ce que l'écran lit est préchargé ici (TanStack Query)
// puis hydraté côté client, sur les mêmes clés que le reste de l'app — cocher
// une tâche ou une habitude ici met donc à jour /taches, /habitudes et
// l'accueil sans câblage supplémentaire. Même patron que /agenda.
export default async function AujourdhuiPage() {
  const today = await getToday();
  const queryClient = makeServerQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: queryKeys.taches, queryFn: getTachesAvecRelationsEnCache }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.evenementsDuJour(today),
      queryFn: () => getEvenements(today, today),
    }),
    queryClient.prefetchQuery({ queryKey: queryKeys.planningTravail, queryFn: getPlanningTravail }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.planningTravailExceptions,
      queryFn: getPlanningTravailExceptions,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.habitudes(today),
      queryFn: () => getHabitudesDuJourEnCache(today),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.resumeNutrition(today),
      queryFn: () => getResumeNutritionJour(today),
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Aujourd&apos;hui</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AujourdhuiView today={today} />
      </HydrationBoundary>
    </div>
  );
}
