"use client";

import { useQuery } from "@tanstack/react-query";
import { getCollectionAvecPhotos } from "@/app/actions/collections";
import { queryKeys } from "@/lib/query/keys";
import { AddPhotoButton } from "./AddPhotoButton";
import { CollectionHeader } from "./CollectionHeader";
import { PhotosGrid } from "./PhotosGrid";
import { TransitionLink } from "@/components/TransitionLink";
import { errorText, linkButton } from "@/lib/ui";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { GridSkeleton } from "@/components/skeletons/GridSkeleton";

// Vue client : la donnée est préchargée côté serveur (page.tsx, patron de
// objectifs/page.tsx) puis relue ici via TanStack Query, pour partager le cache
// avec les mutations optimistes. `notFound()` n'étant documenté que pour les
// Server Components, un élément introuvable affiche un message inline.
export function CollectionDetailView({ id }: { id: string }) {
  const { data: collection, isLoading, isError } = useQuery({
    queryKey: queryKeys.collection(id),
    queryFn: () => getCollectionAvecPhotos(id),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="mt-1 h-6 w-2/5" />
        </div>
        <Skeleton className="h-11 w-full rounded-2xl" />
        <GridSkeleton />
      </div>
    );
  }

  if (isError || !collection) {
    return (
      <div className="flex flex-col gap-3">
        <TransitionLink href="/collection" className={linkButton}>
          ‹ Collection
        </TransitionLink>
        <p className={errorText}>
          {isError ? "Erreur de chargement de la collection." : "Collection introuvable."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader collection={collection} />
      <AddPhotoButton collectionId={id} />
      <PhotosGrid photos={collection.photos} collectionId={id} />
    </div>
  );
}
