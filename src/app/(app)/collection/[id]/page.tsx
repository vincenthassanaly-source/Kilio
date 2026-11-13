import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getCollectionAvecPhotos } from "@/app/actions/collections";
import { CollectionDetailView } from "./CollectionDetailView";

// « Décrire » analyse jusqu'à 4 éléments en parallèle par appel (téléchargement
// de l'image + Gemini, jusqu'à 50 s) : au-delà du plafond par défaut d'une fonction.
export const maxDuration = 60;

// Server Component async : précharge côté serveur, hydraté avant que
// CollectionDetailView ne prenne le relais côté client. Évite l'aller-retour Server Action déclenché après hydratation.
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
