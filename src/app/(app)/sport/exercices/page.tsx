import { Suspense } from "react";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getBibliothequeEnCache } from "@/lib/sport/cache";
import { ExercicesView } from "./ExercicesView";
import { ExercicesSkeleton } from "./ExercicesSkeleton";
import { screenTitle } from "@/lib/ui";

// Lue après connection(), sous <Suspense> : la bibliothèque dépend de la base
// (pas de prérendu au build) et le titre reste dans la coquille statique.
async function Bibliotheque() {
  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.sportBibliotheque,
    queryFn: getBibliothequeEnCache,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExercicesView />
    </HydrationBoundary>
  );
}

export default function ExercicesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Exercices</h1>
      <Suspense fallback={<ExercicesSkeleton />}>
        <Bibliotheque />
      </Suspense>
    </div>
  );
}
