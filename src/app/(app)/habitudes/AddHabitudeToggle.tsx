"use client";

import { AnimatePresence } from "framer-motion";
import { HabitudeForm } from "./HabitudeForm";
import { Modal } from "@/components/Modal";
import { useBackClose } from "@/hooks/useBackClose";

/**
 * Ajout d'une habitude par bouton flottant « + », comme Tâches : la feuille
 * « Nouvelle habitude » s'ouvre au-dessus de la liste. L'état d'ouverture est
 * tenu par l'écran (l'état vide ouvre la même feuille).
 */
export function AddHabitudeToggle({
  ouvert,
  onOuvertChange,
  onSaved,
}: {
  ouvert: boolean;
  onOuvertChange: (ouvert: boolean) => void;
  onSaved?: () => void;
}) {
  useBackClose(ouvert, () => onOuvertChange(false));

  return (
    <>
      <button
        type="button"
        data-masquer-saisie
        onClick={() => onOuvertChange(true)}
        aria-label="Ajouter une habitude"
        aria-haspopup="dialog"
        className="fixed right-[max(1rem,calc(50%-20rem))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-kcal text-on-kcal shadow-float transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 90px)", viewTransitionName: "fab" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <AnimatePresence>
        {ouvert && (
          <Modal key="nouvelle-habitude" title="Nouvelle habitude" onClose={() => onOuvertChange(false)}>
            <HabitudeForm
              onDone={() => {
                onOuvertChange(false);
                onSaved?.();
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
