"use client";

import { useState, useRef } from "react";
import { useBackClose } from "@/hooks/useBackClose";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Portal } from "@/components/Portal";
import { FadeInImage } from "@/components/FadeInImage";
import { estUrlHttp } from "@/lib/url-sure";

/** Overlay plein écran pour agrandir une image au tap. Fermeture au tap
 * n'importe où (y compris sur l'image, cf. object-contain qui laisse de
 * l'espace vide autour) ou sur le bouton ×. Générique, pas spécifique au
 * module Tâches. */
export function ImageLightbox({
  src,
  alt = "Photo agrandie",
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  // Ce composant n'est monté que pendant que le lightbox est ouvert : `active`
  // vaut donc toujours true tant qu'il existe dans l'arbre.
  useBackClose(true, onClose);
  // T14 : focus piégé dans l'overlay, Échap ferme, focus rendu à la fermeture.
  const overlayRef = useRef<HTMLDivElement>(null);
  useDialogFocus(overlayRef, onClose);

  async function handleDownload(event: React.MouseEvent) {
    event.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const lastSegment = src.split("/").pop()?.split("?")[0];
      const filename = lastSegment && lastSegment.length > 0 ? lastSegment : `kilio-photo-${Date.now()}.jpg`;
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      if (estUrlHttp(src)) window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  // Rendu dans un portal (T14) : plus déformé par l'`active:scale` d'une
  // carte parente (DocumentCard, grilles de Collection).
  return (
    <Portal>
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Photo agrandie"
      className="fixed inset-0 z-50 bg-black/80 outline-none"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        aria-label="Télécharger"
        className="absolute right-[68px] top-[calc(env(safe-area-inset-top)+16px)] flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div className="absolute inset-4">
        <FadeInImage src={src} alt={alt} fill sizes="100vw" className="object-contain" />
      </div>
    </div>
    </Portal>
  );
}
