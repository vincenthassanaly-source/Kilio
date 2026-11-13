"use client";

import type { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { dangerButton, primaryButton, secondaryButton } from "@/lib/ui";

const dangerPleinButton =
  "rounded-2xl bg-alert px-4 py-2.5 font-semibold text-on-accent transition active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/**
 * Confirmation explicite, avec les conséquences, pour les actions qui ne sont
 * PAS la suppression d'un élément : quitter sans enregistrer, remise à zéro,
 * vidage d'un brouillon, réglage qui supprimera des données plus tard. Toute
 * suppression d'élément passe par `supprimerAvecAnnulation` (toast « Annuler »,
 * voir lib/actions/suppressionDifferee.ts), jamais par ce dialogue.
 *
 * Le bouton de confirmation nomme l'action (« Supprimer le compte et
 * 42 transactions »), le bouton sûr est le premier dans l'ordre de tabulation.
 *
 * `gardePrimaire` : quand l'utilisateur vient de demander l'inverse de ce que
 * le dialogue propose (ex. « Terminer » une séance sans série validée), le
 * bouton sûr « Garder » devient l'action principale et l'action destructrice
 * passe en style discret (bordure rouge), au lieu du rouge plein.
 */
export function ConfirmDialog({
  open,
  titre,
  children,
  confirmer,
  destructif = true,
  gardePrimaire = false,
  enCours = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  titre: string;
  children: ReactNode;
  confirmer: string;
  destructif?: boolean;
  gardePrimaire?: boolean;
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
            <div className={`flex gap-2 sm:flex-row sm:justify-end ${gardePrimaire ? "flex-col" : "flex-col-reverse"}`}>
              <button type="button" onClick={onClose} className={gardePrimaire ? primaryButton : secondaryButton}>
                Garder
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={enCours}
                className={destructif ? (gardePrimaire ? dangerButton : dangerPleinButton) : primaryButton}
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
