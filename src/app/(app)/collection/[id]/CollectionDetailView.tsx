"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCollectionAvecPhotos, type CollectionAvecPhotos } from "@/app/actions/collections";
import { queryKeys } from "@/lib/query/keys";
import { TAILLE_LOT_TITRAGE, lotADecrire, peutEtreDecrit, titrageDisponible } from "@/lib/collection/titrage";
import { EtincelleIcon } from "@/components/EtincelleIcon";
import type { Tables } from "@/lib/supabase/types";
import { secondaryButton } from "@/lib/ui";
import { AddPhotoButton } from "./AddPhotoButton";
import { CollectionHeader } from "./CollectionHeader";
import { PhotosGrid } from "./PhotosGrid";
import { TitrageModal } from "./TitrageModal";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { GridSkeleton } from "@/components/skeletons/GridSkeleton";
import { ErrorInline } from "@/components/ErrorInline";
import { showErrorToast } from "@/components/toast/toast-store";
import { BackLink } from "@/components/BackLink";

// Vue client : la donnée est préchargée côté serveur (page.tsx) puis relue ici
// via TanStack Query, pour partager le cache avec les mutations optimistes. `notFound()` n'étant documenté que pour les
// Server Components, un élément introuvable affiche un message inline.
export function CollectionDetailView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: collection, isLoading, isError, isRefetchError, refetch } = useQuery({
    queryKey: queryKeys.collection(id),
    queryFn: () => getCollectionAvecPhotos(id),
  });
  // Lot en cours de titrage par Gemini (null = fenêtre fermée).
  const [lotTitrage, setLotTitrage] = useState<Tables<"collection_items">[] | null>(null);

  // Un rechargement en échec garde l'écran déjà affiché : toast, pas d'effacement.
  useEffect(() => {
    if (isRefetchError) showErrorToast("Actualisation impossible. L'affichage peut être périmé.");
  }, [isRefetchError]);

  // Ouvre le titrage sur les éléments sans description, les plus récents
  // d'abord. Lit le cache plutôt que la valeur rendue : après un ajout, la
  // collection vient d'être rechargée et le rendu n'a pas encore suivi.
  function ouvrirTitrage() {
    const courante = queryClient.getQueryData<CollectionAvecPhotos | null>(queryKeys.collection(id));
    if (!courante || !titrageDisponible(courante.photos)) return;
    const lot = lotADecrire(courante.photos);
    if (lot.length > 0) setLotTitrage(lot);
  }

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

  if (!collection) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink href="/collection">Collection</BackLink>
        {isError ? (
          <ErrorInline titre="Chargement impossible" message="La collection n'a pas pu être chargée." retry={() => refetch()} />
        ) : (
          <ErrorInline titre="Collection introuvable" message="Elle a peut-être été supprimée." />
        )}
      </div>
    );
  }

  // Sans la colonne `description` (migration pas encore appliquée), le
  // titrage reste masqué : l'écran est celui d'avant.
  // Les vidéos sans miniature ni légende ne comptent pas : Gemini n'aurait rien à regarder.
  const nbADecrire = titrageDisponible(collection.photos) ? collection.photos.filter(peutEtreDecrit).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader collection={collection} />
      <AddPhotoButton collectionId={id} onAjoute={ouvrirTitrage} />
      {nbADecrire > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
          <p className="min-w-0 text-small text-ink-2">
            <span className="font-semibold text-ink">
              {nbADecrire} élément{nbADecrire > 1 ? "s" : ""}
            </span>{" "}
            à décrire avec l&apos;IA
            {nbADecrire > TAILLE_LOT_TITRAGE ? ` (${TAILLE_LOT_TITRAGE} à la fois)` : ""}
          </p>
          <button
            type="button"
            onClick={ouvrirTitrage}
            aria-label="Décrire ces éléments avec l'IA"
            className={`${secondaryButton} rounded-xl! flex shrink-0 items-center justify-center gap-2`}
          >
            <EtincelleIcon />
            Décrire
          </button>
        </div>
      )}
      <PhotosGrid photos={collection.photos} collectionId={id} />
      {lotTitrage && <TitrageModal collectionId={id} lot={lotTitrage} onClose={() => setLotTitrage(null)} />}
    </div>
  );
}
