"use client";

import type { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { primaryButton, secondaryButton } from "@/lib/ui";

const dangerPleinButton =
  "rounded-2xl bg-alert px-4 py-2.5 font-semibold text-on-accent transition active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/**
 * Confirmation explicite, avec les conséquences, pour les actions qu'on ne
 * peut pas annuler par un toast (suppression en cascade, réglage qui
 * supprime des données plus tard) — constat T2 de l'audit. Pour une
 * suppression simple, préférer `supprimerAvecAnnulation` (toast « Annuler »).
 *
 * Le bouton de confirmation nomme l'action (« Supprimer le compte et
 * 42 transactions »), le bouton sûr est le premier dans l'ordre de tabulation.
 */
export function ConfirmDialog({
  open,
  titre,
  children,
  confirmer,
  destructif = true,
  enCours = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  titre: string;
  children: ReactNode;
  confirmer: string;
  destructif?: boolean;
  enCours?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // `Modal` se rend dans un portal (T14) : le dialogue peut être déclaré dans
  // une ligne de liste transformée (`listCard`, `active:scale`).
  return (
    <AnimatePresence>
      {open && (
        <Modal key="confirm" title={titre} onClose={onClose}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-body leading-snug text-ink-2">{children}</div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className={secondaryButton}>
                Garder
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={enCours}
                className={destructif ? dangerPleinButton : primaryButton}
              >
                {enCours ? "En cours…" : confirmer}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  );
}
