"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getResumeNutritionJour } from "@/app/actions/journal";
import { setJourEntrainement } from "@/app/actions/entrainement";
import { queryKeys } from "@/lib/query/keys";
import { errorText } from "@/lib/ui";

/**
 * Bouton haltère du jour : vert quand aujourd'hui est un jour d'entraînement,
 * ce qui fait prendre la cible « entraînement » au Journal et au dashboard.
 * L'état se lit dans le résumé nutritionnel déjà préchargé par la page.
 */
export function EntrainementBouton({ today }: { today: string }) {
  const queryClient = useQueryClient();
  const { data: resume } = useQuery({
    queryKey: queryKeys.resumeNutrition(today),
    queryFn: () => getResumeNutritionJour(today),
  });
  const [pending, startTransition] = useTransition();
  const [entraine, setEntraine] = useOptimistic(resume?.jourType === "entrainement");
  const [error, setError] = useState<string | null>(null);

  function basculer() {
    const suivant = !entraine;
    setError(null);
    startTransition(async () => {
      setEntraine(suivant);
      const resultat = await setJourEntrainement(today, suivant);
      if (resultat.error) {
        setError(resultat.error);
        return;
      }
      // revalidatePath ne touche pas les cartes lues via TanStack Query
      // (dashboard, carte Repas) : on invalide leur résumé nutritionnel.
      await queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={entraine}
        aria-label="Jour d'entraînement"
        disabled={pending || !resume}
        onClick={basculer}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-[0.97] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kcal ${
          entraine
            ? "border-transparent bg-kcal text-on-kcal"
            : "border-line bg-surface text-ink-2 hover:bg-surface-alt"
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
        </svg>
      </button>
      {error && (
        <p className={`${errorText} max-w-[12rem] text-right text-xs`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
