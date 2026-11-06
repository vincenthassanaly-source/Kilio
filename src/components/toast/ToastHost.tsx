"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { dismissToast, getToasts, subscribeToasts } from "./toast-store";

// Référence stable : useSyncExternalStore compare par === entre deux
// rendus, une nouvelle référence à chaque appel (ex. `() => []`) déclenche
// une boucle de re-rendu infinie.
const EMPTY_TOASTS: never[] = [];
function getServerSnapshot() {
  return EMPTY_TOASTS;
}

/** Empile de courts toasts d'erreur discrets en bas d'écran (au-dessus de la
 * bottom nav), utilisés pour signaler le rollback silencieux d'une mutation
 * optimiste. Montée une seule fois dans src/app/providers.tsx. */
export function ToastHost() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getServerSnapshot);
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
    >
      <AnimatePresence>
        {items.map((toast) =>
          toast.action ? (
            // Toast à action (ex. « Annuler » après une suppression) : un
            // <div> avec un bouton dédié à l'intérieur, pas un <button>
            // englobant (imbrication de boutons invalide en HTML) comme les
            // toasts simples ci-dessous. Le texte reste tel quel (pas de tap
            // pour masquer sur autre chose que le bouton) ; seule l'action
            // (ou le délai) ferme le toast.
            <motion.div
              key={toast.id}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              className="pointer-events-auto flex max-w-[90vw] items-center gap-1 rounded-full border border-line bg-surface py-1 pl-4 pr-1 text-small font-medium text-ink shadow-card"
            >
              <span className="truncate">{toast.text}</span>
              <button
                type="button"
                onClick={() => {
                  toast.action?.onAction();
                  dismissToast(toast.id);
                }}
                aria-label={toast.action.ariaLabel ?? toast.action.label}
                className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full px-2.5 text-sm font-semibold text-kcal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
              >
                {toast.action.label}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key={toast.id}
              type="button"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              onClick={() => dismissToast(toast.id)}
              aria-label={`${toast.text} — appuyer pour masquer`}
              role={toast.tone === "error" ? "alert" : undefined}
              className={`pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-full border bg-surface px-4 py-2 text-left text-small font-medium text-ink shadow-card ${
                toast.tone === "error" ? "border-alert/40" : "border-line"
              }`}
            >
              {toast.tone === "error" && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-alert)" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="shrink-0">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5v5.5M12 16.5v.01" />
                </svg>
              )}
              {toast.text}
            </motion.button>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
