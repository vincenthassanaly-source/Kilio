import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getCollectionAvecPhotos } from "@/app/actions/collections";
import { CollectionDetailView } from "./CollectionDetailView";

// Server Component async : précharge côté serveur (même patron que
// objectifs/page.tsx), hydraté avant que CollectionDetailView ne prenne le relais côté
// client. Évite l'aller-retour Server Action déclenché après hydratation.
export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.collection(id), queryFn: () => getCollectionAvecPhotos(id) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CollectionDetailView id={id} />
    </HydrationBoundary>
  );
}
