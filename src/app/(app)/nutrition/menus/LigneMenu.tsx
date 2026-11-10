"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { annulerValidationMenuEntry, removeMenuEntry, validerMenuEntry } from "@/app/actions/menus";
import { CheckToggle } from "@/components/CheckToggle";
import { showActionToast } from "@/components/toast/toast-store";
import { vibrate } from "@/lib/haptics";
import { runAction } from "@/lib/actions/runAction";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";

/** Un repas planifié, prêt à afficher (calculé côté serveur, voir MenusSemaine). */
export type RepasPlanifie = {
  id: string;
  label: string;
  detail: string;
  kcal: number;
  mange: boolean;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/**
 * Ligne d'un créneau : la coche valide « mangé » (le repas entre dans le
 * Journal, annulable depuis le toast ou en décochant), la croix le retire du
 * menu. Coche optimiste : elle bouge au tap, et revient seule si l'action
 * échoue (le toast d'erreur vient de runAction).
 */
export function LigneMenu({ repas }: { repas: RepasPlanifie }) {
  const queryClient = useQueryClient();
  const [mange, setMange] = useOptimistic(repas.mange);
  const [, startTransition] = useTransition();
  const [retire, setRetire] = useState(false);

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

  // Retrait immédiat, annulable pendant le délai du toast : plus de dialogue.
  function retirer() {
    supprimerAvecAnnulation({
      texte: `« ${repas.label} » retiré du menu`,
      ariaLabel: `Annuler le retrait de « ${repas.label} » du menu`,
      masquer: () => setRetire(true),
      restaurer: () => setRetire(false),
      supprimer: () => removeMenuEntry(repas.id),
      erreur: `Impossible de retirer « ${repas.label} ». Réessaie.`,
    });
  }

  if (retire) return null;

  return (
    <li className="flex min-h-12 items-center gap-3 py-1">
      <CheckToggle
        checked={mange}
        onToggle={basculer}
        label={mange ? `Annuler « ${repas.label} » mangé` : `Marquer « ${repas.label} » comme mangé`}
        hitSlop={11}
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-body font-semibold ${mange ? "text-ink-2" : "text-ink"}`}>{repas.label}</p>
        <p className="truncate text-xs text-ink-2">{repas.detail}</p>
      </div>
      <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-ink-2">
        {Math.round(repas.kcal)} kcal
      </span>
      <button
        type="button"
        onClick={retirer}
        aria-label={`Retirer « ${repas.label} » du menu`}
        className={`-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-3 transition active:scale-[0.97] hover:bg-surface-alt ${focusRing}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}
