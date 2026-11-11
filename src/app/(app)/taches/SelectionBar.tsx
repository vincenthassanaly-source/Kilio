"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  deplacerTaches,
  restaurerTaches,
  supprimerTaches,
  type EtatTacheRestaurable,
  type TacheAvecRelations,
} from "@/app/actions/taches";
import { showActionToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import type { ActionResult } from "@/lib/actions/result";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { queryKeys } from "@/lib/query/keys";
import type { CibleReport } from "@/lib/taches/compute";
import { masquerTaches, reafficherTaches } from "@/lib/taches/masquees";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, ghostButton } from "@/lib/ui";
import { LIBELLES_REPORT, useReporterTaches } from "./useReporterTaches";

const linkButtonSel =
  "relative inline-flex min-h-11 items-center rounded-xl px-2 text-label font-semibold text-kcal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

const REPORTS = (Object.keys(LIBELLES_REPORT) as CibleReport[]).map((cible) => ({
  cible,
  label: LIBELLES_REPORT[cible],
}));

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
  toutesLesIds,
  onToutSelectionner,
  onDone,
}: {
  ids: ReadonlySet<string>;
  taches: TacheAvecRelations[];
  listes: Tables<"listes_taches">[];
  /** Tâches actives affichées, pour « Tout sélectionner ». */
  toutesLesIds: string[];
  onToutSelectionner: (ids: string[]) => void;
  /** Quitte le mode sélection (après une action ou « Fermer »). */
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const reporterEtAnnuler = useReporterTaches();
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

  function reporter(cible: CibleReport) {
    const choisies = taches.filter((t) => ids.has(t.id));
    startTransition(async () => {
      if (await reporterEtAnnuler(choisies, cible)) onDone();
    });
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
      className="fixed inset-x-3 z-40 mx-auto flex max-w-2xl flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-float"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
    >
      {/* Sortie du mode : bouton « Quitter » ci-contre (Échap gère aussi, cf.
          TachesView). L'entrée se fait par appui long sur une carte. */}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-label font-semibold text-ink" aria-live="polite">
          {vide ? "Touche des tâches pour les choisir" : pluriel(nombre) + (nombre > 1 ? " sélectionnées" : " sélectionnée")}
        </p>
        {nombre < toutesLesIds.length && (
          <button type="button" onClick={() => onToutSelectionner(toutesLesIds)} className={linkButtonSel}>
            Tout sélectionner
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          aria-label="Quitter la sélection"
          className="relative -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {panneau === "reporter" && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reporter à">
          {REPORTS.map(({ cible, label }) => (
            <button
              key={cible}
              type="button"
              disabled={vide || pending}
              onClick={() => reporter(cible)}
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

      {/* Actions masquées tant que rien n'est choisi : des boutons grisés
          occupaient la place du contenu sans rien proposer. */}
      {!vide && (
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
      )}
    </div>
  );
}
