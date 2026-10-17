import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getAnnonce } from "@/app/actions/vinted";
import { AnnonceView } from "./AnnonceView";

// Même patron que collection/[id]/page.tsx : l'annonce est préchargée côté
// serveur puis relue côté client via TanStack Query.
export default async function AnnonceVintedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.vintedAnnonce(id), queryFn: () => getAnnonce(id) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnnonceView id={id} />
    </HydrationBoundary>
  );
}
