"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { deleteCollectionItem, rafraichirMiniatureVideo } from "@/app/actions/collections";
import { queryKeys } from "@/lib/query/keys";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { FadeInImage } from "@/components/FadeInImage";
import { indexDepart, videosDuFil } from "@/lib/collection/fil";
import { estTypeVideo } from "@/lib/collection/video";
import type { Tables } from "@/lib/supabase/types";
import { vibrate } from "@/lib/haptics";

const ImageLightbox = dynamic(() => import("@/components/ImageLightbox").then((m) => m.ImageLightbox), {
  ssr: false,
});
const VideoFeed = dynamic(() => import("@/components/VideoFeed").then((m) => m.VideoFeed), {
  ssr: false,
});

function TiktokIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 4v10.2a3.3 3.3 0 1 1-2.6-3.23" />
      <path d="M14 4c.3 2.2 1.9 3.8 4 4" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10 9.2v5.6l4.8-2.8L10 9.2z" fill="currentColor" />
    </svg>
  );
}

function VideoBadge({ type }: { type: string }) {
  const estYoutube = type === "youtube";
  return (
    <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
      {estYoutube ? <YoutubeIcon /> : <TiktokIcon />}
      {estYoutube ? "YouTube" : "TikTok"}
    </span>
  );
}

function ariaLabelOuverture(type: string): string {
  if (type === "tiktok") return "Lire la vidéo TikTok";
  if (type === "youtube") return "Lire la vidéo YouTube";
  return "Agrandir la photo";
}

export function PhotosGrid({
  photos,
  collectionId,
}: {
  photos: Tables<"collection_items">[];
  collectionId: string;
}) {
  const [lightboxItem, setLightboxItem] = useState<Tables<"collection_items"> | null>(null);
  const queryClient = useQueryClient();

  // Photos masquées le temps du toast « Annuler » (constat T2 : la
  // suppression retirait le fichier du Storage en un tap, sans retour
  // possible). L'appel serveur n'a lieu qu'à l'expiration du toast ;
  // « Annuler » réaffiche simplement la photo, rien n'a encore été effacé.
  const [masquees, setMasquees] = useState<ReadonlySet<string>>(() => new Set());
  const visibles = photos.filter((p) => !masquees.has(p.id));

  // Miniatures TikTok expirées : au premier échec de chargement d'une tuile,
  // on en redemande une fraîche au serveur (une seule tentative par vidéo et
  // par ouverture). Sans réponse, la tuile garde un fond uni plutôt qu'une
  // image cassée.
  const [miniaturesRafraichies, setMiniaturesRafraichies] = useState<Readonly<Record<string, string>>>({});
  const [sansMiniature, setSansMiniature] = useState<ReadonlySet<string>>(() => new Set());
  const reparationsTentees = useRef<Set<string>>(new Set());

  function reparerMiniature(photo: Tables<"collection_items">) {
    if (photo.type !== "tiktok" || reparationsTentees.current.has(photo.id)) {
      setSansMiniature((s) => new Set(s).add(photo.id));
      return;
    }
    reparationsTentees.current.add(photo.id);
    rafraichirMiniatureVideo(photo.id)
      .then((resultat) => {
        if (!resultat.ok) throw new Error(resultat.error);
        setMiniaturesRafraichies((m) => ({ ...m, [photo.id]: resultat.data }));
        queryClient.invalidateQueries({ queryKey: queryKeys.collection(collectionId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.collections });
      })
      .catch(() => setSansMiniature((s) => new Set(s).add(photo.id)));
  }
  // Fil plein écran : toutes les vidéos du classeur, dans l'ordre de la grille.
  const videos = videosDuFil(visibles);

  function supprimer(photo: Tables<"collection_items">) {
    vibrate();
    const libelle = estTypeVideo(photo.type) ? "Vidéo" : "Photo";
    supprimerAvecAnnulation({
      texte: `${libelle} supprimée`,
      ariaLabel: `Annuler la suppression de la ${libelle.toLowerCase()}`,
      masquer: () => setMasquees((m) => new Set(m).add(photo.id)),
      restaurer: () =>
        setMasquees((m) => {
          const suivant = new Set(m);
          suivant.delete(photo.id);
          return suivant;
        }),
      supprimer: () => deleteCollectionItem(photo.id),
      erreur: `Impossible de supprimer la ${libelle.toLowerCase()}. Réessaie.`,
      onSupprime: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.collection(collectionId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.collections });
      },
    });
  }

  if (visibles.length === 0) {
    return <p className="text-ink-2">Aucune photo pour l&apos;instant.</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-2">
        <AnimatePresence initial={false}>
          {visibles.map((photo, index) => {
            const estVideo = estTypeVideo(photo.type);
            const src = estVideo
              ? (miniaturesRafraichies[photo.id] ?? photo.thumbnail_url ?? photo.url)
              : photo.url;
            const miniatureIndisponible = estVideo && sansMiniature.has(photo.id);

            return (
              <motion.li
                key={photo.id}
                layout
                className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-alt"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.3) }}
              >
                <button
                  type="button"
                  onClick={() => setLightboxItem(photo)}
                  aria-label={ariaLabelOuverture(photo.type)}
                  className="relative block h-full w-full"
                >
                  {miniatureIndisponible ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-surface-alt"
                      style={index === 0 ? { viewTransitionName: `collection-cover-${collectionId}` } : undefined}
                    />
                  ) : (
                    <FadeInImage
                      key={src}
                      src={src}
                      alt=""
                      fill
                      sizes="50vw"
                      unoptimized={estVideo}
                      onError={estVideo ? () => reparerMiniature(photo) : undefined}
                      style={index === 0 ? { viewTransitionName: `collection-cover-${collectionId}` } : undefined}
                      className="object-cover"
                    />
                  )}
                  {estVideo && <VideoBadge type={photo.type} />}
                </button>
                {/* Zone de tap de 44 px, pastille visible de 28 px. */}
                <button
                  type="button"
                  onClick={() => supprimer(photo)}
                  aria-label={estVideo ? "Supprimer la vidéo" : "Supprimer la photo"}
                  className="group absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white group-focus-visible:ring-2 group-focus-visible:ring-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {lightboxItem &&
        (estTypeVideo(lightboxItem.type) ? (
          <VideoFeed
            videos={videos}
            indexDepart={indexDepart(videos, lightboxItem.id)}
            onClose={() => setLightboxItem(null)}
          />
        ) : (
          <ImageLightbox src={lightboxItem.url} onClose={() => setLightboxItem(null)} />
        ))}
    </>
  );
}
