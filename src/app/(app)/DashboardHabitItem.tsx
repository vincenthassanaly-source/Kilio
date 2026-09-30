"use client";

import { memo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enregistrerEntreeHabitude, type HabitudeDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import { ProgressRing } from "@/components/ProgressRing";
import { vibrate } from "@/lib/haptics";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";

export const DashboardHabitItem = memo(function DashboardHabitItem({
  habitude,
  date,
}: {
  habitude: HabitudeDuJour;
  date: string;
}) {
  const queryClient = useQueryClient();
  const valeur = habitude.entreeDuJour?.valeur ?? 0;
  const fait = valeur > 0;
  const pct =
    habitude.type === "quantifiee" && habitude.valeur_cible
      ? valeur / habitude.valeur_cible
      : fait
        ? 1
        : 0;

  // Même mutation optimiste que HabitudeCard (src/app/(app)/habitudes/HabitudeCard.tsx),
  // sur la même query key : cocher depuis le dashboard ou /habitudes met à
  // jour le même cache.
  const toggleMutation = useMutation({
    mutationFn: async (nouvelleValeur: number) => {
      vibrate();
      try {
        await enregistrerEntreeHabitude(habitude.id, date, nouvelleValeur);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("habitudes", "enregistrerEntreeHabitude", [habitude.id, date, nouvelleValeur]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
      }
    },
    onMutate: async (nouvelleValeur) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habitudes(date) });
      const previous = queryClient.getQueryData<HabitudeDuJour[]>(queryKeys.habitudes(date));
      queryClient.setQueryData<HabitudeDuJour[]>(queryKeys.habitudes(date), (old) =>
        old?.map((h) =>
          h.id === habitude.id
            ? {
                ...h,
                entreeDuJour: h.entreeDuJour
                  ? { ...h.entreeDuJour, valeur: nouvelleValeur }
                  : { id: "", habitude_id: h.id, date, valeur: nouvelleValeur, created_at: new Date().toISOString() },
              }
            : h
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.habitudes(date), context.previous);
      showToast("Impossible de mettre à jour l'habitude.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habitudes(date) });
      queryClient.invalidateQueries({ queryKey: ["objectif"] });
    },
  });

  function toggle() {
    if (habitude.type === "quantifiee") return;
    toggleMutation.mutate(fait ? 0 : 1);
  }

  return (
    <button
      type="button"
      disabled={toggleMutation.isPending || habitude.type === "quantifiee"}
      onClick={toggle}
      className="flex w-[60px] shrink-0 flex-col items-center gap-1.5"
    >
      <ProgressRing size={50} strokeWidth={5} pct={pct} color="var(--accent-habitudes)">
        <span className="text-base leading-none">{habitude.icone || "✓"}</span>
      </ProgressRing>
      <span className="max-w-full truncate text-[11px] font-semibold text-ink-2">{habitude.nom}</span>
      {(habitude.type === "streak" || habitude.frequence_hebdo != null) && habitude.streak > 0 && (
        <span className="text-[11px] font-bold text-habitudes">🔥{habitude.streak}</span>
      )}
    </button>
  );
});
