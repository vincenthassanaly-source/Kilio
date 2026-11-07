"use client";

import { useEffect, useRef, useState } from "react";

type Etat = "repos" | "copie" | "echec";

const DUREE_RETOUR_MS = 2000;

/** Bouton « copier le lien » d'une vignette vidéo : copie l'URL d'origine
 * (YouTube/TikTok), puis affiche une coche (ou une croix en cas d'échec)
 * 2 s avant de revenir à l'icône de départ. Zone de tap de 44 px, pastille
 * visible de 28 px, comme le bouton Supprimer. */
export function CopierLienVideoButton({ url }: { url: string }) {
  const [etat, setEtat] = useState<Etat>("repos");
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

  async function copier() {
    let resultat: Etat;
    try {
      await navigator.clipboard.writeText(url);
      resultat = "copie";
    } catch {
      resultat = "echec";
    }
    setEtat(resultat);
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setEtat("repos"), DUREE_RETOUR_MS);
  }

  const message = etat === "copie" ? "Lien copié" : etat === "echec" ? "Échec de la copie" : "";

  return (
    <>
      <button
        type="button"
        onClick={copier}
        aria-label="Copier le lien de la vidéo"
        className="group absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white group-focus-visible:ring-2 group-focus-visible:ring-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {etat === "copie" ? (
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            ) : etat === "echec" ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <>
                <rect x="9" y="9" width="11" height="11" rx="2.5" />
                <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
              </>
            )}
          </svg>
        </span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </>
  );
}
