"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { removeJournalEntry } from "@/app/actions/journal";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { addNutrition, zeroNutrition, type Nutrition } from "@/lib/nutrition/compute";
import type { JourType } from "@/lib/nutrition/planning";
import { queryKeys } from "@/lib/query/keys";
import { card, sectionTitle } from "@/lib/ui";
import { AjoutRepasBouton } from "./AjoutRepasBouton";
import { JournalEntriesList, type JournalEntryView } from "./JournalEntriesList";
import { ResumeJour } from "./ResumeJour";

/**
 * Résumé du jour et repas du jour. Un repas supprimé disparaît tout de suite
 * (toast « Annuler » pendant 6 s, la suppression réelle n'a lieu qu'ensuite) :
 * le résumé, la liste et l'état vide sont donc calculés sur les repas visibles,
 * pour qu'aucun chiffre ne contredise ce qui est affiché.
 */
export function JournalRepas({
  entries,
  cible,
  date,
  estAujourdhui = true,
  jourType,
}: {
  entries: JournalEntryView[];
  cible: Nutrition | null;
  date: string;
  estAujourdhui?: boolean;
  jourType?: JourType;
}) {
  const queryClient = useQueryClient();
  const [masques, setMasques] = useState<ReadonlySet<string>>(() => new Set());
  const visibles = entries.filter((e) => !masques.has(e.id));
  const consomme = visibles.reduce((acc, v) => addNutrition(acc, v.nutrition), zeroNutrition());

  function supprimer(id: string) {
    const entry = entries.find((e) => e.id === id);
    const nom = entry ? `« ${entry.label} »` : "ce repas";
    supprimerAvecAnnulation({
      texte: `${nom} supprimé du journal`,
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
      onSupprime: () => {
        // Même invalidation que le chemin "ajout" (useAjoutRepasTermine) :
        // sans ça, la carte nutrition du dashboard et le catalogue
        // "Récents" continuent de compter ce repas jusqu'à 30s après sa
        // suppression (CLICK-PATH-202).
        queryClient.invalidateQueries({ queryKey: queryKeys.catalogueJournal });
        queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
      },
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Résumé du jour</h2>
        <ResumeJour consomme={consomme} cible={cible} estAujourdhui={estAujourdhui} jourType={jourType} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Repas du jour</h2>
        {visibles.length === 0 ? (
          <div className={`${card} flex flex-col items-center gap-2.5 py-8 text-center`}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" aria-hidden="true">
              <line x1="5" y1="19" x2="5" y2="11" />
              <line x1="12" y1="19" x2="12" y2="5" />
              <line x1="19" y1="19" x2="19" y2="14" />
            </svg>
            <p className="text-body font-bold text-ink">Aucun repas enregistré pour ce jour.</p>
            <AjoutRepasBouton date={date} variante="carte" estAujourdhui={estAujourdhui} />
          </div>
        ) : (
          <JournalEntriesList entries={visibles} onDelete={supprimer} />
        )}
      </div>
    </>
  );
}
