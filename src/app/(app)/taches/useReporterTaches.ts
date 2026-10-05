"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reporterTaches, restaurerTaches, type TacheAvecRelations } from "@/app/actions/taches";
import { showActionToast } from "@/components/toast/toast-store";
import { aujourdhuiISO } from "@/lib/date/recurrence";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { dateReport, type CibleReport } from "@/lib/taches/compute";

export const LIBELLES_REPORT: Record<CibleReport, string> = {
  aujourdhui: "Aujourd'hui",
  demain: "Demain",
  semaine_prochaine: "Lundi",
};

type Reportable = Pick<TacheAvecRelations, "id" | "titre" | "echeance" | "liste_id" | "ordre">;

/**
 * Reporte l'échéance de tâches (une ou plusieurs) à « aujourd'hui », « demain »
 * ou « lundi », puis propose « Annuler » : l'état d'avant est relevé au tap et
 * rétabli côté serveur par `restaurerTaches`. Partagé par la barre de
 * sélection de /taches et la section « En retard » de /aujourdhui.
 * Renvoie `true` si le report a réussi.
 */
export function useReporterTaches() {
  const queryClient = useQueryClient();

  return useCallback(
    async (taches: readonly Reportable[], cible: CibleReport): Promise<boolean> => {
      if (taches.length === 0) return false;
      const avant = taches.map((t) => ({ id: t.id, echeance: t.echeance, liste_id: t.liste_id, ordre: t.ordre }));
      const ids = avant.map((t) => t.id);
      const date = dateReport(cible, aujourdhuiISO());
      const invalider = () => queryClient.invalidateQueries({ queryKey: queryKeys.taches });

      const resultat = await runAction(() => reporterTaches(ids, date));
      if (!resultat.ok) return false;
      await invalider();

      const libelle = LIBELLES_REPORT[cible].toLowerCase();
      const texte =
        taches.length === 1
          ? `« ${taches[0].titre} » reportée à « ${libelle} »`
          : `${taches.length} tâches reportées à « ${libelle} »`;
      showActionToast(texte, {
        ariaLabel: `Annuler : ${texte}`,
        onAction: () => {
          void runAction(() => restaurerTaches(avant), { erreur: "Impossible d'annuler. Réessaie." }).then((r) => {
            if (r.ok) void invalider();
          });
        },
      });
      return true;
    },
    [queryClient]
  );
}
