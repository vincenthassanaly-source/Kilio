"use client";

import { useOptimistic, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { annulerValidationMenuEntry, removeMenuEntry, updateMenuEntry, validerMenuEntry } from "@/app/actions/menus";
import { CheckToggle } from "@/components/CheckToggle";
import { Modal } from "@/components/Modal";
import { showActionToast, showToast } from "@/components/toast/toast-store";
import { useBackClose } from "@/hooks/useBackClose";
import { AJOUT_LABELS, type MomentRepas } from "@/lib/nutrition/compute";
import { vibrate } from "@/lib/haptics";
import { runAction } from "@/lib/actions/runAction";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { useMasques } from "@/lib/actions/elementsMasques";

// Même panneau que la saisie (dosage, aperçu macros), chargé à la demande.
const AjoutRepasPanneau = dynamic(
  () => import("../journal/AjoutRepasPanneau").then((m) => m.AjoutRepasPanneau),
  { ssr: false }
);

/** Un repas planifié, prêt à afficher (calculé côté serveur, voir MenusSemaine). */
export type RepasPlanifie = {
  id: string;
  label: string;
  detail: string;
  kcal: number;
  mange: boolean;
  /** De quoi rouvrir le dosage pré-rempli : clé catalogue, quantité stockée, créneau et jour. */
  cle: string;
  quantite: number;
  moment: MomentRepas;
  date: string;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/**
 * Ligne d'un créneau : la coche valide « mangé » (le repas entre dans le
 * Journal, annulable depuis le toast ou en décochant), la croix le retire du
 * menu. Coche optimiste : elle bouge au tap, et revient seule si l'action
 * échoue (le toast d'erreur vient de runAction).
 */
export function LigneMenu({ repas, jourLabel }: { repas: RepasPlanifie; jourLabel?: string }) {
  const queryClient = useQueryClient();
  const [edition, setEdition] = useState(false);
  useBackClose(edition, () => setEdition(false));
  const [mange, setMange] = useOptimistic(repas.mange);
  const [, startTransition] = useTransition();
  // Repas en cours de retrait (toast « Annuler » encore affiché) : caché.
  const retire = useMasques("menu-repas").has(repas.id);

  function rafraichirResume() {
    void queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
  }

  function basculer() {
    const suivant = !mange;
    startTransition(async () => {
      setMange(suivant);
      const resultat = await runAction(() => (suivant ? validerMenuEntry(repas.id) : annulerValidationMenuEntry(repas.id)));
      if (!resultat.ok) return;
      vibrate();
      rafraichirResume();
      if (suivant) {
        showActionToast(`« ${repas.label} » ajouté au Carnet alimentaire`, {
          ariaLabel: `Annuler l'ajout de « ${repas.label} » au Carnet alimentaire`,
          onAction: () => {
            void runAction(() => annulerValidationMenuEntry(repas.id)).then((r) => {
              if (r.ok) rafraichirResume();
            });
          },
        });
      }
    });
  }

  // Retrait différé : le repas disparaît tout de suite du menu, « Annuler » le
  // ramène pendant le délai du toast. Les totaux du jour et de la semaine sont
  // calculés côté serveur sur les repas planifiés : ils ne tiennent compte du
  // retrait qu'à l'expiration du délai (puis à la revalidation), pas au geste.
  function retirer() {
    supprimerAvecAnnulation({
      texte: mange
        ? `« ${repas.label} » retiré du menu · reste dans le Carnet alimentaire`
        : `« ${repas.label} » retiré du menu`,
      ariaLabel: `Annuler le retrait de « ${repas.label} » du menu`,
      masque: { type: "menu-repas", id: repas.id },
      supprimer: () => removeMenuEntry(repas.id),
      erreur: `Impossible de retirer « ${repas.label} » du menu. Réessaie.`,
      onSupprime: rafraichirResume,
    });
  }

  if (retire) return null;

  return (
    <li className="flex min-h-12 items-center gap-3 py-1">
      <CheckToggle
        checked={mange}
        onToggle={basculer}
        label={`Marquer « ${repas.label} » comme mangé`}
        hitSlop={11}
      />
      {/* Nom, détail et kcal : un tap rouvre le dosage (quantité, créneau). */}
      <button
        type="button"
        onClick={() => setEdition(true)}
        aria-haspopup="dialog"
        aria-label={`Modifier « ${repas.label} », ${repas.detail}`}
        className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left ${focusRing}`}
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-body font-semibold ${mange ? "text-ink-2" : "text-ink"}`}>{repas.label}</span>
          <span className="block truncate text-caption text-ink-2">{repas.detail}</span>
        </span>
        <span className="shrink-0 font-display text-small font-semibold tabular-nums text-ink-2">
          {Math.round(repas.kcal).toLocaleString("fr-FR")} kcal
        </span>
      </button>
      <button
        type="button"
        onClick={retirer}
        aria-label={`Retirer « ${repas.label} » du menu`}
        className={`-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-2 transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] hover:bg-surface-alt hover:text-alert ${focusRing}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <AnimatePresence>
        {edition && (
          <Modal key="modifier-menu" title={`Modifier « ${repas.label} »${jourLabel ? ` · ${jourLabel}` : ""}`} onClose={() => history.back()}>
            <AjoutRepasPanneau
              date={repas.date}
              edition={{ id: repas.id, cle: repas.cle, quantite: repas.quantite, moment: repas.moment }}
              action={updateMenuEntry}
              onAjoute={(item, moment) => {
                if (mange) rafraichirResume();
                showToast(`« ${item.nom} » modifié, ${AJOUT_LABELS[moment]}`);
                history.back();
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </li>
  );
}
