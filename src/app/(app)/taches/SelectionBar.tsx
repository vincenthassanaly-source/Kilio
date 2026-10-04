"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  deplacerTaches,
  reporterTaches,
  restaurerTaches,
  supprimerTaches,
  type EtatTacheRestaurable,
  type TacheAvecRelations,
} from "@/app/actions/taches";
import { showActionToast } from "@/components/toast/toast-store";
import { aujourdhuiISO } from "@/lib/budget/compute";
import { runAction } from "@/lib/actions/runAction";
import type { ActionResult } from "@/lib/actions/result";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { queryKeys } from "@/lib/query/keys";
import { dateReport, type CibleReport } from "@/lib/taches/compute";
import { masquerTaches, reafficherTaches } from "@/lib/taches/masquees";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, ghostButton } from "@/lib/ui";

const REPORTS: { cible: CibleReport; label: string }[] = [
  { cible: "aujourdhui", label: "Aujourd'hui" },
  { cible: "demain", label: "Demain" },
  { cible: "semaine_prochaine", label: "Lundi" },
];

function pluriel(n: number) {
  return n === 1 ? "1 tâche" : `${n} tâches`;
}

/**
 * Barre d'actions de la sélection multiple de /taches : reporter, changer de
 * liste, supprimer. Chaque action est annulable depuis son toast. L'état
 * d'avant (échéance, liste, ordre) est relevé dans le cache au moment du tap,
 * « Annuler » le rétablit côté serveur.
 */
export function SelectionBar({
  ids,
  taches,
  listes,
  onDone,
}: {
  ids: ReadonlySet<string>;
  taches: TacheAvecRelations[];
  listes: Tables<"listes_taches">[];
  /** Quitte le mode sélection (après une action ou « Terminer »). */
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [panneau, setPanneau] = useState<"reporter" | "liste" | null>(null);
  const [pending, startTransition] = useTransition();
  const nombre = ids.size;
  const vide = nombre === 0;

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.taches });
  }

  function instantane(): EtatTacheRestaurable[] {
    return taches
      .filter((t) => ids.has(t.id))
      .map((t) => ({ id: t.id, echeance: t.echeance, liste_id: t.liste_id, ordre: t.ordre }));
  }

  // Applique une action groupée puis propose « Annuler » (rétablit l'état
  // relevé avant l'action).
  function appliquer(texte: string, action: () => Promise<ActionResult>) {
    const avant = instantane();
    const nb = avant.length;
    startTransition(async () => {
      const resultat = await runAction(action);
      if (!resultat.ok) return;
      await invalidate();
      onDone();
      showActionToast(`${texte} (${pluriel(nb)})`, {
        ariaLabel: `Annuler : ${texte}`,
        onAction: () => {
          void runAction(() => restaurerTaches(avant), { erreur: "Impossible d'annuler. Réessaie." }).then((r) => {
            if (r.ok) void invalidate();
          });
        },
      });
    });
  }

  function reporter(cible: CibleReport, label: string) {
    const date = dateReport(cible, aujourdhuiISO());
    const liste = [...ids];
    appliquer(`Reporté à « ${label.toLowerCase()} »`, () => reporterTaches(liste, date));
  }

  function deplacer(listeId: string, nom: string) {
    const liste = [...ids];
    appliquer(`Déplacé vers « ${nom} »`, () => deplacerTaches(liste, listeId));
  }

  function supprimer() {
    const liste = [...ids];
    onDone();
    supprimerAvecAnnulation({
      texte: `${pluriel(liste.length)} supprimée${liste.length > 1 ? "s" : ""}`,
      ariaLabel: `Annuler la suppression de ${pluriel(liste.length)}`,
      masquer: () => masquerTaches(liste),
      restaurer: () => reafficherTaches(liste),
      supprimer: () => supprimerTaches(liste),
      erreur: `Impossible de supprimer ${pluriel(liste.length)}. Réessaie.`,
      onSupprime: () => {
        void invalidate().then(() => reafficherTaches(liste));
      },
    });
  }

  return (
    <div
      role="toolbar"
      aria-label="Actions sur la sélection"
      className="fixed inset-x-3 z-40 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-card"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {vide ? "Aucune tâche sélectionnée" : pluriel(nombre) + (nombre > 1 ? " sélectionnées" : " sélectionnée")}
        </p>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-kcal">
          Terminer
        </button>
      </div>

      {panneau === "reporter" && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reporter à">
          {REPORTS.map(({ cible, label }) => (
            <button
              key={cible}
              type="button"
              disabled={vide || pending}
              onClick={() => reporter(cible, label)}
              className={`${ghostButton} disabled:opacity-40`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {panneau === "liste" && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Déplacer vers la liste">
          {listes.map((liste) => (
            <button
              key={liste.id}
              type="button"
              disabled={vide || pending}
              onClick={() => deplacer(liste.id, liste.nom)}
              className={`${ghostButton} disabled:opacity-40`}
            >
              {liste.nom}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={vide}
          aria-expanded={panneau === "reporter"}
          onClick={() => setPanneau((p) => (p === "reporter" ? null : "reporter"))}
          className={`${ghostButton} disabled:opacity-40`}
        >
          Reporter
        </button>
        <button
          type="button"
          disabled={vide}
          aria-expanded={panneau === "liste"}
          onClick={() => setPanneau((p) => (p === "liste" ? null : "liste"))}
          className={`${ghostButton} disabled:opacity-40`}
        >
          Changer de liste
        </button>
        <button type="button" disabled={vide || pending} onClick={supprimer} className={dangerButton}>
          Supprimer
        </button>
      </div>
    </div>
  );
}
