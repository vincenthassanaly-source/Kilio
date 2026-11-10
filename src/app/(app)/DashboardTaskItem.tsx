"use client";

import { memo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { annulerCochage, setTacheFait, type TacheAvecRelations } from "@/app/actions/taches";
import { queryKeys } from "@/lib/query/keys";
import { restaurerElement } from "@/lib/query/rollback";
import { showActionToast, showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { CheckToggle } from "@/components/CheckToggle";
import { vibrate } from "@/lib/haptics";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";

export const DashboardTaskItem = memo(function DashboardTaskItem({
  id,
  titre,
  heure,
  fait,
  echeance,
  detail,
}: {
  id: string;
  titre: string;
  heure: string | null;
  fait: boolean;
  // Échéance vue à l'écran, transmise à setTacheFait (garde d'idempotence
  // des tâches récurrentes, voir TasksList.tsx).
  echeance: string | null;
  // Texte discret à droite à la place de l'heure (ex. « il y a 3 j » pour une
  // tâche en retard).
  detail?: string;
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
      return { previous, avaitFait: fait, echeance };
    },
    onError: (_err, _vars, context) => {
      restaurerElement(queryClient, queryKeys.taches, context?.previous, id);
      showToast("Impossible de mettre à jour la tâche.");
    },
    // Action en file : on garde l'état optimiste jusqu'au rejeu (voir TaskCard).
    onSettled: (resultat) => {
      if (!resultat?.enfile) queryClient.invalidateQueries({ queryKey: queryKeys.taches });
    },
    // Même toast « Annuler » que sur /taches : cocher est le geste le plus
    // fréquent et le plus facile à rater au pouce.
    onSuccess: (resultat, _vars, context) => {
      if (resultat.enfile || !context || context.avaitFait) return;
      showActionToast(`« ${titre} » faite`, {
        ariaLabel: `Annuler : « ${titre} » faite`,
        onAction: () => {
          queryClient.setQueryData<TacheAvecRelations[]>(queryKeys.taches, (old) =>
            old?.map((t) => (t.id === id ? { ...t, fait: false } : t))
          );
          void runAction(() => annulerCochage(id, false, context.echeance ?? undefined), {
            erreur: "Impossible d'annuler. Réessaie.",
            onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.taches }),
          }).then((r) => {
            if (r.ok) void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
          });
        },
      });
    },
  });

  return (
    <div className="flex items-start gap-2.5">
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
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
        <span
          className="line-clamp-2 break-words text-body font-semibold"
          style={{
            color: fait ? "var(--ink-2)" : "var(--ink)",
            textDecoration: fait ? "line-through" : "none",
          }}
        >
          {titre}
        </span>
        {(detail ?? heure?.slice(0, 5)) && (
          <span className="shrink-0 text-caption font-medium tabular-nums text-ink-3">{detail ?? heure?.slice(0, 5)}</span>
        )}
      </div>
    </div>
  );
});
