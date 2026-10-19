"use client";

import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Portal } from "@/components/Portal";

/**
 * Pastille flottante « Filtres » : n'apparaît que lorsque la barre de suivi du
 * programme est passée au-dessus de l'écran ET que le parti ouvert est encore
 * visible. Un tap ramène à la barre. Rien ne reste à l'écran pendant la lecture
 * tant qu'on n'a pas dépassé la barre, et elle ne cache jamais le texte (coin bas,
 * au-dessus de la barre de navigation).
 */
export function BoutonRetourBarre({
  barreRef,
  panneauRef,
  onClick,
}: {
  barreRef: RefObject<HTMLElement | null>;
  panneauRef: RefObject<HTMLElement | null>;
  onClick: () => void;
}) {
  const [barreAuDessus, setBarreAuDessus] = useState(false);
  const [panneauVisible, setPanneauVisible] = useState(false);

  useEffect(() => {
    const barre = barreRef.current;
    const panneau = panneauRef.current;
    if (!barre || !panneau || typeof IntersectionObserver === "undefined") return;
    const observerBarre = new IntersectionObserver(([entree]) => {
      setBarreAuDessus(!entree.isIntersecting && entree.boundingClientRect.bottom < 0);
    });
    const observerPanneau = new IntersectionObserver(([entree]) => setPanneauVisible(entree.isIntersecting));
    observerBarre.observe(barre);
    observerPanneau.observe(panneau);
    return () => {
      observerBarre.disconnect();
      observerPanneau.disconnect();
    };
  }, [barreRef, panneauRef]);

  const visible = barreAuDessus && panneauVisible;

  return (
    <Portal>
      <AnimatePresence>
        {visible && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={onClick}
            aria-label="Remonter aux filtres, aux thèmes et à la progression de lecture"
            className="fixed right-4 z-30 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[13px] font-semibold text-ink shadow-card active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
            Filtres
          </motion.button>
        )}
      </AnimatePresence>
    </Portal>
  );
}
