"use client";

import { useRef, useState, useTransition } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ajouterEtape,
  deplacerEtape,
  supprimerEtape,
  toggleEtape,
  type ObjectifDetail,
} from "@/app/actions/objectifs";
import { queryKeys } from "@/lib/query/keys";
import { showToast } from "@/components/toast/toast-store";
import type { Tables } from "@/lib/supabase/types";
import { card, dangerButton, ghostButton, input, sectionTitle } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";
import { CheckToggle } from "@/components/CheckToggle";
import { vibrate } from "@/lib/haptics";

// Cocher/décocher une étape est l'action la plus fréquente de ce type de
// suivi : même mécanisme optimiste (setQueryData + rollback) que
// TaskCard/HabitudeCard, sur le cache combiné {objectif, etapes, entries}
// de la page détail (queryKeys.objectif). Les autres actions
// (ajouter/déplacer/supprimer) restent en Server Action + useTransition,
// avec invalidateQueries en fin d'action plutôt qu'un rendu optimiste local
// (même patron que SousTachesList dans taches/TasksList.tsx) : ces Server
// Actions appellent toujours `revalidatePath`, mais ce mécanisme n'a plus
// d'effet sur le cache TanStack de cette page, désormais chargée côté
// client.
export function ObjectifSuiviEtapes({
  objectifId,
  etapes,
}: {
  objectifId: string;
  etapes: Tables<"objectif_etapes">[];
}) {
  const [isPending, startTransition] = useTransition();
  const [titre, setTitre] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();

  const faites = etapes.filter((e) => e.fait).length;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.objectif(objectifId) });
  }

  const toggleMutation = useMutation({
    mutationFn: (etape: Tables<"objectif_etapes">) => {
      vibrate();
      return toggleEtape(objectifId, etape.id, !etape.fait);
    },
    onMutate: async (etape) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.objectif(objectifId) });
      const previous = queryClient.getQueryData<ObjectifDetail>(queryKeys.objectif(objectifId));
      queryClient.setQueryData<ObjectifDetail>(queryKeys.objectif(objectifId), (old) =>
        old
          ? { ...old, etapes: old.etapes.map((e) => (e.id === etape.id ? { ...e, fait: !e.fait } : e)) }
          : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.objectif(objectifId), context.previous);
      showToast("Impossible de mettre à jour l'étape.");
    },
    onSettled: invalidate,
  });

  function handleAjouter(formData: FormData) {
    const valeur = String(formData.get("titre") ?? "");
    if (!valeur.trim()) return;
    startTransition(async () => {
      try {
        await ajouterEtape(objectifId, valeur);
        invalidate();
        // Vidé seulement après succès : un échec garde la saisie (T1).
        setTitre("");
        formRef.current?.reset();
      } catch {
        showToast("Impossible d'ajouter cette étape. Réessaie.");
      }
    });
  }

  function handleDeplacer(etape: Tables<"objectif_etapes">, direction: "haut" | "bas") {
    startTransition(async () => {
      try {
        await deplacerEtape(objectifId, etape.id, direction);
        invalidate();
      } catch {
        showToast("Impossible de réordonner l'étape.");
      }
    });
  }

  function handleSupprimer(etape: Tables<"objectif_etapes">) {
    if (!confirmDelete(`Supprimer l'étape « ${etape.titre} » ?`)) return;
    startTransition(async () => {
      try {
        await supprimerEtape(objectifId, etape.id);
        invalidate();
      } catch {
        showToast("Impossible de supprimer l'étape.");
      }
    });
  }

  return (
    <div className={`${card} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <h2 className={sectionTitle}>Étapes</h2>
        <span className="text-[13px] text-ink-2">
          {faites}/{etapes.length}
        </span>
      </div>

      {etapes.length === 0 ? (
        <p className="text-ink-2">Aucune étape pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {etapes.map((etape, index) => (
            <li key={etape.id} className="flex items-center gap-2">
              <CheckToggle
                checked={etape.fait}
                disabled={toggleMutation.isPending}
                onToggle={() => toggleMutation.mutate(etape)}
                color="var(--accent-objectifs)"
                label={etape.fait ? "Marquer non fait" : "Marquer fait"}
                // `<ul className="gap-2">` (8px) : hitSlop réduit, voir
                // reports/2026-09-16-fix-dashboard-audit-constats-1-2.md.
                hitSlop={3}
              />
              <span className={`flex-1 text-[14.5px] text-ink ${etape.fait ? "text-ink-2 line-through" : ""}`}>
                {etape.titre}
              </span>
              <button
                type="button"
                disabled={isPending || index === 0}
                onClick={() => handleDeplacer(etape, "haut")}
                className={`${ghostButton} px-2 py-1 disabled:opacity-30`}
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={isPending || index === etapes.length - 1}
                onClick={() => handleDeplacer(etape, "bas")}
                className={`${ghostButton} px-2 py-1 disabled:opacity-30`}
                aria-label="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSupprimer(etape)}
                className={`${dangerButton} px-2 py-1`}
              >
                Suppr.
              </button>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={handleAjouter} className="flex gap-2">
        <input
          name="titre"
          placeholder="Nouvelle étape…"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          className={`${input} min-w-0 flex-1`}
        />
        <button type="submit" disabled={isPending} className={ghostButton}>
          Ajouter
        </button>
      </form>
    </div>
  );
}
