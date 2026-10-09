import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getEvenements } from "@/app/actions/evenements";
import { shiftDate } from "@/lib/date/iso";
import { queryKeys } from "@/lib/query/keys";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { getTachesAvecRelationsEnCache } from "@/lib/taches/cache";
import { screenTitle } from "@/lib/ui";
import { getToday } from "../today";
import { RevueView } from "./RevueView";

// Shell serveur : tâches et événements préchargés puis hydratés côté client,
// sur les mêmes clés que Aujourd'hui et l'Agenda (cocher ou reporter ici met
// donc tout le reste à jour).
export default async function RevuePage() {
  const today = await getToday();
  const queryClient = makeServerQueryClient();
  const passeDebut = shiftDate(today, -6);
  const avenirDebut = shiftDate(today, 1);
  const avenirFin = shiftDate(today, 7);
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: queryKeys.taches, queryFn: getTachesAvecRelationsEnCache }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.evenementsPlage(passeDebut, today),
      queryFn: () => getEvenements(passeDebut, today),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.evenementsPlage(avenirDebut, avenirFin),
      queryFn: () => getEvenements(avenirDebut, avenirFin),
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <h1 className={screenTitle}>Revue de la semaine</h1>
        <RevueView today={today} />
      </HydrationBoundary>
    </div>
  );
}
