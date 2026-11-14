"use client";

import { useId, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Portal } from "@/components/Portal";
import { useDialogFocus } from "@/hooks/useDialogFocus";

// Feuille du bas : glissée depuis le bas + fondu du fond, sur le modèle de
// ToastHost.tsx (déjà animé via framer-motion). Ces props `initial`/`exit`
// ne jouent que si le composant est monté/démonté sous un <AnimatePresence>
// côté appelant (QuickAddFab.tsx, AgendaView.tsx) — sans ça, `exit` est
// silencieusement ignoré par framer-motion et seule l'entrée s'anime.
//
// Vague 2 (T14) : rendue dans un portal (plus déformée par un ancêtre
// transformé), focus piégé et rendu à la fermeture, Échap ferme, titre relié
// par un id unique, hauteur en `dvh` (le clavier virtuel ne la masque plus),
// bouton Fermer de 44 px.
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const titreId = useId();
  const feuilleRef = useRef<HTMLDivElement>(null);
  useDialogFocus(feuilleRef, onClose);

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          ref={feuilleRef}
          tabIndex={-1}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
          className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-card border border-line bg-surface shadow-float outline-none sm:mb-6 sm:rounded-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titreId}
          onClick={(e) => e.stopPropagation()}
          // Empêche un geste tactile dans la modale (ex. défilement horizontal
          // d'un contenu interne) de remonter jusqu'au <main> de TabSwipeWrapper
          // et d'y être interprété comme un swipe de navigation entre onglets.
          // (Le portal ne change pas la propagation des événements React.)
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line py-1.5 pl-4 pr-1.5">
            <h2 id={titreId} className="text-body font-bold text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div
            className="overflow-y-auto overscroll-contain px-4 pt-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
          >
            {children}
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
}
