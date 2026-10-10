"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useBackClose } from "@/hooks/useBackClose";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Portal } from "@/components/Portal";
import { indexApresPas, indexDepuisScroll } from "@/lib/collection/fil";
import { extraireIdVideoTiktok } from "@/lib/collection/tiktok";
import { extraireIdVideoYoutube } from "@/lib/collection/youtube";
import type { Tables } from "@/lib/supabase/types";

type Video = Tables<"collection_items">;

function Lecteur({ video, muet }: { video: Video; muet: boolean }) {
  const [idTiktok, setIdTiktok] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);
  const estTiktok = video.type === "tiktok";

  useEffect(() => {
    if (!estTiktok) return;
    let annule = false;
    extraireIdVideoTiktok(video.url).then((id) => {
      if (annule) return;
      if (id) setIdTiktok(id);
      else setErreur(true);
    });
    return () => {
      annule = true;
    };
  }, [estTiktok, video.url]);

  if (!estTiktok) {
    const id = extraireIdVideoYoutube(video.url);
    if (!id) return <Message texte="Impossible de charger cette vidéo YouTube." />;
    return (
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1${muet ? "&mute=1" : ""}&playsinline=1`}
        title="Vidéo YouTube"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        className="aspect-video max-h-full w-full max-w-[960px] border-0"
      />
    );
  }
  if (erreur) return <Message texte="Impossible de charger cette vidéo TikTok." />;
  if (!idTiktok) return <Message texte="Chargement…" faible />;
  return (
    <iframe
      src={`https://www.tiktok.com/embed/v2/${idTiktok}`}
      title="Vidéo TikTok"
      allow="autoplay; encrypted-media; fullscreen"
      allowFullScreen
      className="h-full max-h-full w-full max-w-[420px] border-0"
    />
  );
}

function Message({ texte, faible }: { texte: string; faible?: boolean }) {
  return <p className={`px-6 text-center text-sm ${faible ? "text-white/60" : "text-white/80"}`}>{texte}</p>;
}

function Fleche({ sens, onClick, desactive }: { sens: -1 | 1; onClick: () => void; desactive: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={sens === -1 ? "Vidéo précédente" : "Vidéo suivante"}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={sens === -1 ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
      </svg>
    </button>
  );
}

/** Fil vidéo plein écran façon TikTok/Reels : une vidéo par écran, scroll
 * vertical avec accroche (`scroll-snap`). Seule la vidéo visible est montée
 * (autoplay) ; les autres écrans affichent leur miniature. Les iframes
 * captent le toucher : des bandeaux de swipe sur les bords laissent le geste
 * au conteneur, et des flèches / la molette / ↑↓ complètent la navigation. */
export function VideoFeed({
  videos,
  indexDepart,
  onClose,
}: {
  videos: Video[];
  indexDepart: number;
  onClose: () => void;
}) {
  const [courant, setCourant] = useState(indexDepart);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useBackClose(true, onClose);
  useDialogFocus(overlayRef, onClose);

  // Positionne le fil sur la vidéo ouverte avant le premier rendu visible.
  useLayoutEffect(() => {
    const el = conteneurRef.current;
    if (el) el.scrollTop = indexDepart * el.clientHeight;
  }, [indexDepart]);

  const surScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = conteneurRef.current;
      if (el) setCourant(indexDepuisScroll(el.scrollTop, el.clientHeight, videos.length));
    });
  }, [videos.length]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const aller = useCallback(
    (pas: -1 | 1) => {
      const el = conteneurRef.current;
      if (!el) return;
      const cible = indexApresPas(courant, pas, videos.length);
      el.scrollTo({ top: cible * el.clientHeight, behavior: "smooth" });
    },
    [courant, videos.length],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        aller(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        aller(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aller]);

  return (
    <Portal>
      <div
        ref={overlayRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Fil de vidéos"
        className="fixed inset-0 z-50 bg-black outline-none"
      >
        <div
          ref={conteneurRef}
          onScroll={surScroll}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]"
        >
          {videos.map((video, index) => (
            <section
              key={video.id}
              aria-label={video.titre || `Vidéo ${index + 1} sur ${videos.length}`}
              aria-hidden={index !== courant}
              className="relative flex h-dvh w-full snap-start snap-always items-center justify-center"
            >
              {index === courant ? (
                <Lecteur video={video} muet={courant !== indexDepart} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- miniature externe (CDN YouTube/TikTok), hors remotePatterns
                <img
                  src={video.thumbnail_url ?? undefined}
                  alt=""
                  className="max-h-full max-w-full object-contain opacity-60"
                />
              )}
              {/* Bandeaux de swipe : au-dessus de l'iframe, ils laissent le
                  geste vertical au conteneur scrollable. */}
              <div aria-hidden="true" className="absolute inset-y-0 left-0 w-10 touch-pan-y" />
              <div aria-hidden="true" className="absolute inset-y-0 right-0 w-10 touch-pan-y" />
            </section>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
          <Fleche sens={-1} onClick={() => aller(-1)} desactive={courant === 0} />
          <Fleche sens={1} onClick={() => aller(1)} desactive={courant === videos.length - 1} />
        </div>
        <p className="pointer-events-none absolute left-4 top-[calc(env(safe-area-inset-top)+28px)] z-10 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
          {courant + 1} / {videos.length}
        </p>
      </div>
    </Portal>
  );
}
