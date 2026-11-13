import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getJourRevue } from "@/app/actions/briefing";
import { getEvenements } from "@/app/actions/evenements";
import { getResumeNutritionJour } from "@/app/actions/journal";
import { getPlanningTravail, getPlanningTravailExceptions } from "@/app/actions/planning-travail";
import { getJoursFeries } from "@/app/actions/jours-feries";
import { getJoursLibresAutour } from "@/app/actions/jours-libres";
import { getMesuresRecentes } from "@/app/actions/sante";
import { getSemaineSeances } from "@/app/actions/seances";
import { getHabitudesDuJourEnCache } from "@/lib/habitudes/cache";
import { queryKeys } from "@/lib/query/keys";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { getTachesAvecRelationsEnCache } from "@/lib/taches/cache";
import { getToday } from "../today";
import { AujourdhuiView } from "./AujourdhuiView";

// Contenu serveur de l'écran du jour (route « / ») : tout ce qu'il lit est
// préchargé ici (TanStack Query) puis hydraté côté client, sur les mêmes clés
// que le reste de l'app — cocher une tâche ou une habitude ici met donc à jour
// /taches et /habitudes sans câblage supplémentaire. Même patron que /agenda.
export async function AujourdhuiContenu() {
  const today = await getToday();
  const queryClient = makeServerQueryClient();
  const [jourRevue] = await Promise.all([
    getJourRevue(),
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
    queryClient.prefetchQuery({
      queryKey: queryKeys.seancesSemaine(today),
      queryFn: () => getSemaineSeances(today),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.joursFeries(today, today),
      // Informatif : une panne (base ou API) ne doit pas faire échouer l'écran.
      queryFn: () => getJoursFeries(today, today).catch(() => []),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.joursLibresAutour(today),
      queryFn: () => getJoursLibresAutour(today),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.mesuresRecentes,
      queryFn: () => getMesuresRecentes(5),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AujourdhuiView today={today} jourRevue={jourRevue} />
    </HydrationBoundary>
  );
}
