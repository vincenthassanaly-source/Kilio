"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { addMenuEntry } from "@/app/actions/menus";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/toast/toast-store";
import { useBackClose } from "@/hooks/useBackClose";
import { AJOUT_LABELS, MOMENT_LABELS, type MomentRepas } from "@/lib/nutrition/compute";

// Même panneau que le Journal (recherche, récents, quantité, aperçu macros),
// chargé à la demande : la grille de la semaine reste légère.
const AjoutRepasPanneau = dynamic(
  () => import("../journal/AjoutRepasPanneau").then((m) => m.AjoutRepasPanneau),
  { ssr: false }
);

function prechargerPanneau() {
  void import("../journal/AjoutRepasPanneau");
}

const libelleAjoutMenu = (moment: MomentRepas) => `Planifier ${AJOUT_LABELS[moment]}`;

/**
 * Bouton « + » d'un créneau (zone de tap de 44 px) et sa feuille : le créneau
 * est imposé, il ne reste qu'à choisir l'aliment ou la recette et la quantité.
 */
export function AjoutMenuBouton({
  date,
  moment,
  jourLabel,
}: {
  date: string;
  moment: MomentRepas;
  /** Jour en toutes lettres pour le titre de la feuille (« Lundi 12 octobre »). */
  jourLabel: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  useBackClose(ouvert, () => setOuvert(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        onPointerDown={prechargerPanneau}
        onFocus={prechargerPanneau}
        aria-haspopup="dialog"
        aria-label={`Ajouter un repas · ${jourLabel}, ${MOMENT_LABELS[moment]}`}
        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-kcal transition active:scale-[0.97] hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <AnimatePresence>
        {ouvert && (
          <Modal key="ajout-menu" title={`${jourLabel} · ${MOMENT_LABELS[moment]}`} onClose={() => history.back()}>
            <AjoutRepasPanneau
              date={date}
              depart={{ moment }}
              momentFige
              action={addMenuEntry}
              libelleAjout={libelleAjoutMenu}
              onAjoute={(item, momentAjoute) => {
                showToast(`« ${item.nom} » planifié ${AJOUT_LABELS[momentAjoute]}`);
                history.back();
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
