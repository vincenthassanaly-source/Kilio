import { Suspense } from "react";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getDerniereSeanceEnCache, getRoutinesEnCache } from "@/lib/sport/cache";
import { screenTitle } from "@/lib/ui";
import { SportAccueil, SportSkeleton } from "./SportAccueil";

// Lues après connection(), sous <Suspense> : routines et dernière séance
// dépendent de la base (pas de prérendu au build), le titre reste dans la
// coquille statique.
async function Accueil() {
  await connection();
  const queryClient = makeServerQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: queryKeys.sportRoutines, queryFn: getRoutinesEnCache }),
    queryClient.prefetchQuery({ queryKey: queryKeys.sportDerniereSeance, queryFn: getDerniereSeanceEnCache }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SportAccueil />
    </HydrationBoundary>
  );
}

export default function SportPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Sport</h1>
      <Suspense fallback={<SportSkeleton />}>
        <Accueil />
      </Suspense>
    </div>
  );
}
