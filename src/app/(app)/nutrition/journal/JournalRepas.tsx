"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { removeJournalEntry, updateJournalEntry } from "@/app/actions/journal";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/toast/toast-store";
import { useBackClose } from "@/hooks/useBackClose";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { addNutrition, zeroNutrition, type Nutrition } from "@/lib/nutrition/compute";
import type { JourType } from "@/lib/nutrition/planning";
import { queryKeys } from "@/lib/query/keys";
import { card, sectionTitle } from "@/lib/ui";
import { JournalEntriesList, type JournalEntryView } from "./JournalEntriesList";
import { ResumeJour } from "./ResumeJour";

const AjoutRepasPanneau = dynamic(() => import("./AjoutRepasPanneau").then((m) => m.AjoutRepasPanneau), {
  ssr: false,
});

const TYPE_JOUR: Record<JourType, string> = { repos: "repos", entrainement: "entraînement" };

/**
 * Résumé du jour et repas du jour. Un repas supprimé disparaît tout de suite
 * (toast « Annuler » pendant 6 s, la suppression réelle n'a lieu qu'ensuite) :
 * le résumé, la liste et l'état vide sont donc calculés sur les repas visibles,
 * pour qu'aucun chiffre ne contredise ce qui est affiché. Un tap sur un repas
 * rouvre son dosage (quantité et moment) pré-rempli.
 */
export function JournalRepas({
  entries,
  cible,
  date,
  estAujourdhui = true,
  jourType,
  objectifs,
}: {
  entries: JournalEntryView[];
  cible: Nutrition | null;
  date: string;
  estAujourdhui?: boolean;
  jourType?: JourType;
  /** Réglage des objectifs (ObjectifForm), placé sous le résumé. */
  objectifs?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [masques, setMasques] = useState<ReadonlySet<string>>(() => new Set());
  const [edition, setEdition] = useState<JournalEntryView | null>(null);
  useBackClose(edition !== null, () => setEdition(null));
  const visibles = entries.filter((e) => !masques.has(e.id));
  const consomme = visibles.reduce((acc, v) => addNutrition(acc, v.nutrition), zeroNutrition());

  function rafraichir() {
    // Même invalidation que le chemin "ajout" (useAjoutRepasTermine) :
    // sans ça, la carte nutrition du dashboard et le catalogue
    // "Récents" continuent de compter l'ancien repas jusqu'à 30s (CLICK-PATH-202).
    queryClient.invalidateQueries({ queryKey: queryKeys.catalogueJournal });
    queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
  }

  function supprimer(id: string) {
    const entry = entries.find((e) => e.id === id);
    const nom = entry ? `« ${entry.label} »` : "ce repas";
    supprimerAvecAnnulation({
      texte: `${nom} supprimé du Carnet alimentaire`,
      ariaLabel: `Annuler la suppression de ${nom}`,
      masquer: () => setMasques((m) => new Set(m).add(id)),
      restaurer: () =>
        setMasques((m) => {
          const suivant = new Set(m);
          suivant.delete(id);
          return suivant;
        }),
      supprimer: () => removeJournalEntry(id),
      erreur: `Impossible de supprimer ${nom}. Réessaie.`,
      onSupprime: rafraichir,
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>
          Résumé du jour{jourType ? ` · ${TYPE_JOUR[jourType]}` : ""}
        </h2>
        <ResumeJour consomme={consomme} cible={cible} estAujourdhui={estAujourdhui} jourType={jourType} />
        {objectifs}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Repas du jour</h2>
        {visibles.length === 0 ? (
          // Pas de second « Ajouter un repas » ici : le bouton flottant reste
          // affiché en bas, à portée du pouce.
          <div className={`${card} flex flex-col items-center gap-2.5 py-8 text-center`}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <path d="M3.5 4v5a1.5 1.5 0 0 0 3 0V4M5 4v16M20.5 4c-1.5 1-2 3-2 5.5h2V20" />
            </svg>
            <p className="text-body font-bold text-ink">Aucun repas enregistré pour ce jour.</p>
            <p className="text-small text-ink-2 text-pretty">« Ajouter un repas », en bas de l&apos;écran, ouvre la saisie.</p>
          </div>
        ) : (
          <JournalEntriesList entries={visibles} onOpen={setEdition} onDelete={supprimer} />
        )}
      </div>

      <AnimatePresence>
        {edition && (
          <Modal key="modifier-repas" title={`Modifier « ${edition.label} »`} onClose={() => history.back()}>
            <AjoutRepasPanneau
              date={date}
              edition={{ id: edition.id, cle: edition.cle, quantite: edition.quantite, moment: edition.moment }}
              action={updateJournalEntry}
              onAjoute={(item) => {
                rafraichir();
                showToast(`« ${item.nom} » modifié`);
                history.back();
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
