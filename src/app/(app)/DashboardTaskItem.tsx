"use client";

import { memo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setTacheFait, type TacheAvecRelations } from "@/app/actions/taches";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import { CheckToggle } from "@/components/CheckToggle";
import { vibrate } from "@/lib/haptics";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";

export const DashboardTaskItem = memo(function DashboardTaskItem({
  id,
  titre,
  heure,
  fait,
  echeance,
}: {
  id: string;
  titre: string;
  heure: string | null;
  fait: boolean;
  // Échéance vue à l'écran, transmise à setTacheFait (garde d'idempotence
  // des tâches récurrentes, voir TasksList.tsx).
  echeance: string | null;
}) {
  const queryClient = useQueryClient();

  // Même mutation optimiste que TaskCard (src/app/(app)/taches/TasksList.tsx),
  // sur la même query key : cocher une tâche depuis le dashboard ou depuis
  // /taches met à jour le même cache, dans les deux sens.
  const toggleMutation = useMutation({
    // `networkMode: "always"` : sans quoi TanStack Query met la mutation en
    // pause tant qu'il se croit hors ligne (mutationFn jamais exécuté), et
    // le repli hors ligne ci-dessous n'est jamais atteint (voir TaskCard,
    // TasksList.tsx, pour le même correctif).
    networkMode: "always",
    mutationFn: async (): Promise<{ enfile: boolean }> => {
      vibrate();
      const nextFait = !fait;
      try {
        await setTacheFait(id, nextFait, echeance);
        return { enfile: false };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("taches", "setTacheFait", [id, nextFait, echeance]);
        showToast("Enregistré, sera synchronisé à la reconnexion");
        return { enfile: true };
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.taches });
      const previous = queryClient.getQueryData<TacheAvecRelations[]>(queryKeys.taches);
      queryClient.setQueryData<TacheAvecRelations[]>(queryKeys.taches, (old) =>
        old?.map((t) => (t.id === id ? { ...t, fait: !t.fait } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.taches, context.previous);
      showToast("Impossible de mettre à jour la tâche.");
    },
    // Action en file : on garde l'état optimiste jusqu'au rejeu (voir TaskCard).
    onSettled: (resultat) => {
      if (!resultat?.enfile) queryClient.invalidateQueries({ queryKey: queryKeys.taches });
    },
  });

  return (
    <div className="flex items-center gap-2.5">
      <CheckToggle
        checked={fait}
        disabled={toggleMutation.isPending}
        onToggle={() => toggleMutation.mutate()}
        label={fait ? "Marquer non fait" : "Marquer fait"}
        // Lignes empilées avec `gap-2.5` (10px, DashboardTachesSection) : hitSlop
        // réduit pour que deux zones de tap voisines ne se chevauchent pas (voir
        // reports/2026-09-16-fix-dashboard-audit-constats-1-2.md).
        hitSlop={4}
      />
      <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
        <span
          className="truncate text-[14px] font-medium"
          style={{
            color: fait ? "var(--ink-3)" : "var(--ink)",
            textDecoration: fait ? "line-through" : "none",
          }}
        >
          {titre}
        </span>
        {heure && <span className="shrink-0 text-[11.5px] font-medium tabular-nums text-ink-3">{heure.slice(0, 5)}</span>}
      </div>
    </div>
  );
});
