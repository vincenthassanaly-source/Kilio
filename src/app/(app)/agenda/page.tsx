import { connection } from "next/server";
import { addDays, endOfMonth, startOfMonth } from "date-fns";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getListesEnCache, getTachesAvecRelationsEnCache, getTagsEnCache } from "@/lib/taches/cache";
import { getPlanningTravail, getPlanningTravailExceptions } from "@/app/actions/planning-travail";
import { getEvenements } from "@/app/actions/evenements";
import { getJoursFeries } from "@/app/actions/jours-feries";
import { aujourdhuiParis } from "@/lib/date/paris";
import { parseISODate, toISODate } from "@/lib/date/iso";
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
  // Même fenêtre que AgendaView (mois courant ± 1 semaine) : les événements
  // arrivent avec la grille au lieu d'apparaître après coup.
  const aujourdhui = parseISODate(aujourdhuiParis());
  const fenetreDebut = toISODate(addDays(startOfMonth(aujourdhui), -7));
  const fenetreFin = toISODate(addDays(endOfMonth(aujourdhui), 7));
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: queryKeys.taches, queryFn: getTachesAvecRelationsEnCache }),
    queryClient.prefetchQuery({ queryKey: queryKeys.listes, queryFn: getListesEnCache }),
    queryClient.prefetchQuery({ queryKey: queryKeys.tags, queryFn: getTagsEnCache }),
    queryClient.prefetchQuery({ queryKey: queryKeys.planningTravail, queryFn: getPlanningTravail }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.evenementsPlage(fenetreDebut, fenetreFin),
      queryFn: () => getEvenements(fenetreDebut, fenetreFin),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.joursFeries(fenetreDebut, fenetreFin),
      queryFn: () => getJoursFeries(fenetreDebut, fenetreFin),
    }),
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
