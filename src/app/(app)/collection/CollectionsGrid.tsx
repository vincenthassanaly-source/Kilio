"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getCollectionsAvecApercu, type CollectionAvecApercu } from "@/app/actions/collections";
import { queryKeys } from "@/lib/query/keys";
import { CollectionMosaic } from "./CollectionMosaic";
import { AddCollectionToggle } from "./AddCollectionToggle";
import { ReorganiserCollectionsModal } from "./ReorganiserCollectionsModal";
import { EtincelleIcon } from "@/components/EtincelleIcon";
import { TransitionLink } from "@/components/TransitionLink";
import { ghostButton, nameText } from "@/lib/ui";
import { GridSkeleton } from "@/components/skeletons/GridSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ErrorInline } from "@/components/ErrorInline";

function CollectionsMosaic({ collections }: { collections: CollectionAvecApercu[] }) {
  if (collections.length === 0) {
    return <p className="text-ink-2">Aucune collection pour l&apos;instant.</p>;
  }

  return (
    <ul className="columns-2 gap-3">
      {collections.map((collection, index) => (
        <motion.li
          key={collection.id}
          className="mb-3 break-inside-avoid"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: Math.min(index * 0.035, 0.35) }}
          whileTap={{ scale: 0.97 }}
        >
          <TransitionLink href={`/collection/${collection.id}`} className="flex flex-col gap-1.5">
            <CollectionMosaic
              photos={collection.photos_apercu}
              viewTransitionName={`collection-cover-${collection.id}`}
            />
            <p className={nameText} style={{ viewTransitionName: `collection-title-${collection.id}` }}>
              {collection.nom}
            </p>
            <p className="text-xs text-ink-3">
              {collection.nb_photos} photo{collection.nb_photos > 1 ? "s" : ""}
            </p>
          </TransitionLink>
        </motion.li>
      ))}
    </ul>
  );
}

export function CollectionsGrid() {
  const queryClient = useQueryClient();
  const { data: collections, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.collections,
    queryFn: getCollectionsAvecApercu,
  });

  const [reorganiser, setReorganiser] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.collections });
  }

  return (
    <PullToRefresh onRefresh={invalidate}>
      <div className="flex flex-col gap-4">
        <AddCollectionToggle onSaved={invalidate} />
        {(collections?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => setReorganiser(true)}
            aria-label="Réorganiser les collections avec l'IA"
            className={`${ghostButton} flex items-center gap-2 self-start`}
          >
            <EtincelleIcon />
            Réorganiser
          </button>
        )}
        {reorganiser && <ReorganiserCollectionsModal onClose={() => setReorganiser(false)} />}
        {isLoading ? (
          <GridSkeleton />
        ) : isError ? (
          <ErrorInline message="Impossible de charger les collections." retry={() => refetch()} />
        ) : (
          <CollectionsMosaic collections={collections ?? []} />
        )}
      </div>
    </PullToRefresh>
  );
}
