"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getCollectionsAvecApercu, type CollectionAvecApercu } from "@/app/actions/collections";
import { queryKeys } from "@/lib/query/keys";
import { useMasques } from "@/lib/actions/elementsMasques";
import { CollectionMosaic } from "./CollectionMosaic";
import { AddCollectionToggle } from "./AddCollectionToggle";
import { ReorganiserCollectionsModal } from "./ReorganiserCollectionsModal";
import { CollectionsSkeleton } from "./GrilleSkeleton";
import { EtincelleIcon } from "@/components/EtincelleIcon";
import { TransitionLink } from "@/components/TransitionLink";
import { ghostButton, nameText } from "@/lib/ui";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ErrorInline } from "@/components/ErrorInline";
import { showErrorToast } from "@/components/toast/toast-store";

function CollectionsMosaic({ collections }: { collections: CollectionAvecApercu[] }) {
  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-card border border-dashed border-control-border px-6 py-10 text-center">
        <p className="text-body font-semibold text-ink">Aucune collection pour l&apos;instant</p>
        <p className="text-small text-ink-2 text-balance">Crée-en une avec « Ajouter une collection », puis range-y tes photos et tes liens vidéo.</p>
      </div>
    );
  }

  return (
    // Grille remplie ligne par ligne (et non `columns-2`, qui remplit d'abord la
    // colonne de gauche) : l'ordre de lecture suit l'ordre des collections.
    <ul className="grid grid-cols-2 items-start gap-x-3 gap-y-4">
      {collections.map((collection, index) => (
        <motion.li
          key={collection.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: Math.min(index * 0.035, 0.35) }}
          whileTap={{ scale: 0.97 }}
        >
          <TransitionLink href={`/collection/${collection.id}`} className="flex flex-col gap-1.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2">
            <CollectionMosaic
              photos={collection.photos_apercu}
              viewTransitionName={`collection-cover-${collection.id}`}
            />
            <p className={`${nameText} line-clamp-2 whitespace-normal text-balance`} style={{ viewTransitionName: `collection-title-${collection.id}` }}>
              {collection.nom}
            </p>
            <p className="text-caption tabular-nums text-ink-3">
              {collection.nb_photos} élément{collection.nb_photos > 1 ? "s" : ""}
            </p>
          </TransitionLink>
        </motion.li>
      ))}
    </ul>
  );
}

export function CollectionsGrid() {
  const queryClient = useQueryClient();
  const { data: collections, isLoading, isError, isRefetchError, refetch } = useQuery({
    queryKey: queryKeys.collections,
    queryFn: getCollectionsAvecApercu,
  });

  const [reorganiser, setReorganiser] = useState(false);
  // Collection en cours de suppression (toast « Annuler » encore affiché) : cachée.
  const masquees = useMasques("collection");
  const visibles = collections?.filter((c) => !masquees.has(c.id));

  // Un rechargement en échec garde la grille déjà affichée : on le signale
  // par un toast plutôt que de la remplacer par un message d'erreur.
  useEffect(() => {
    if (isRefetchError) showErrorToast("Actualisation impossible. Les collections affichées peuvent être périmées.");
  }, [isRefetchError]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.collections });
  }

  return (
    <PullToRefresh onRefresh={invalidate}>
      <div className="flex flex-col gap-4">
        <AddCollectionToggle onSaved={invalidate} />
        {(visibles?.length ?? 0) > 0 && (
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
          <CollectionsSkeleton />
        ) : isError && !collections ? (
          <ErrorInline message="Impossible de charger les collections." retry={() => refetch()} />
        ) : (
          <CollectionsMosaic collections={visibles ?? []} />
        )}
      </div>
    </PullToRefresh>
  );
}
