"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setJourEntrainement } from "@/app/actions/entrainement";
import { errorText } from "@/lib/ui";

/** Bascule « entraînement / repos » du jour affiché (date passée comprise). */
export function EntrainementToggle({ date, entraine }: { date: string; entraine: boolean }) {
  const [pending, startTransition] = useTransition();
  const [optimiste, setOptimiste] = useOptimistic(entraine);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  function basculer() {
    const suivant = !optimiste;
    setError(null);
    startTransition(async () => {
      setOptimiste(suivant);
      const resultat = await setJourEntrainement(date, suivant);
      if (resultat.error) {
        setError(resultat.error);
        return;
      }
      // revalidatePath ne touche pas les cartes lues via TanStack Query
      // (dashboard, Aujourd'hui) : on invalide leur résumé nutritionnel.
      await queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={optimiste}
        disabled={pending}
        onClick={basculer}
        // Un tap ne doit pas être lu comme un swipe de changement de jour.
        onTouchStart={(e) => e.stopPropagation()}
        className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kcal ${
          optimiste ? "bg-kcal text-on-kcal" : "bg-surface-alt text-ink-2"
        }`}
      >
        <span>{optimiste ? "Jour d'entraînement" : "Jour de repos"}</span>
        <span className="text-xs font-medium opacity-80">{optimiste ? "Appuie pour repos" : "Appuie si tu t'es entraîné"}</span>
      </button>
      {error && (
        <p className={errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
