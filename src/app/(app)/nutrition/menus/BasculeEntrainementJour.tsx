"use client";

import { useOptimistic, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setJourEntrainement } from "@/app/actions/entrainement";
import { showErrorToast } from "@/components/toast/toast-store";

/**
 * Bouton haltère d'un jour du menu : vert quand ce jour est un jour
 * d'entraînement, ce qui compare le menu à la cible « entraînement » plutôt
 * qu'à la cible « repos ». Même statut que le bouton d'Aujourd'hui (table
 * `jours_entrainement`), donc partagé avec le Journal et le Bilan.
 */
export function BasculeEntrainementJour({
  date,
  jourLabel,
  entraine,
}: {
  date: string;
  jourLabel: string;
  entraine: boolean;
}) {
  const queryClient = useQueryClient();
  const [actif, setActif] = useOptimistic(entraine);
  const [enCours, startTransition] = useTransition();

  function basculer() {
    const suivant = !actif;
    startTransition(async () => {
      setActif(suivant);
      const resultat = await setJourEntrainement(date, suivant);
      if (resultat.error) {
        showErrorToast(resultat.error);
        return;
      }
      // revalidatePath ne touche pas les cartes lues via TanStack Query
      // (dashboard, carte Repas) : on invalide leur résumé nutritionnel.
      await queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={`Jour d'entraînement, ${jourLabel}`}
      disabled={enCours}
      onClick={basculer}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-[0.97] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kcal ${
        actif ? "border-transparent bg-kcal text-on-kcal" : "border-line bg-surface text-ink-2 hover:bg-surface-alt"
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
      </svg>
    </button>
  );
}
