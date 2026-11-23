"use client";

import { useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOMENTS_REPAS, MOMENT_LABELS, type Nutrition } from "@/lib/nutrition/compute";
import type { Enums } from "@/lib/supabase/types";
import { cardTight, nameTextComplet } from "@/lib/ui";
import { boutonSupprimerLigne } from "../suppressionLigne";

export type JournalEntryView = {
  id: string;
  moment: Enums<"moment_repas">;
  label: string;
  detail: string;
  nutrition: Nutrition;
  /** Clé catalogue (`aliment:<id>` / `recette:<id>`) et quantité stockée : de quoi rouvrir le dosage. */
  cle: string;
  quantite: number;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

function EntryRow({
  entry,
  onOpen,
  onDelete,
}: {
  entry: JournalEntryView;
  onOpen: (entry: JournalEntryView) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={`${cardTight} flex items-center gap-2 py-2 pr-2`}
    >
      {/* Toute la ligne (nom, détail, kcal) rouvre le dosage pré-rempli. */}
      <button
        type="button"
        onClick={() => onOpen(entry)}
        aria-haspopup="dialog"
        aria-label={`Modifier « ${entry.label} », ${entry.detail}`}
        className={`flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl text-left ${focusRing}`}
      >
        <span className="min-w-0">
          <span className={`block ${nameTextComplet} font-semibold`}>{entry.label}</span>
          <span className="block text-caption text-ink-2">{entry.detail}</span>
        </span>
        <span className="shrink-0 font-display text-body font-semibold tabular-nums text-ink">
          {Math.round(entry.nutrition.kcal).toLocaleString("fr-FR")} kcal
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(entry.id)}
        // Empêche un tap imprécis sur ce petit bouton d'être lu comme un
        // swipe de changement de jour par JournalSwipeWrapper (le geste
        // ne bulle jamais jusqu'à son onTouchStart, voir
        // useSwipeHorizontal.ts) — sans toucher à la sémantique
        // `data-swipe-ignore` (delta de scroll) utilisée ailleurs dans
        // l'app pour les zones réellement scrollables.
        onTouchStart={(e) => e.stopPropagation()}
        aria-label={`Supprimer « ${entry.label} »`}
        className={boutonSupprimerLigne}
      >
        Supprimer
      </button>
    </motion.li>
  );
}

// Liste des repas du jour, présentationnelle : l'état « masqué » (suppression
// annulable en cours) vit dans JournalRepas, qui calcule aussi le résumé sur
// les repas visibles. Un en-tête par moment, avec son sous-total kcal.
export function JournalEntriesList({
  entries,
  onOpen,
  onDelete,
}: {
  entries: JournalEntryView[];
  onOpen: (entry: JournalEntryView) => void;
  onDelete: (id: string) => void;
}) {
  const uid = useId();
  return (
    <div className="flex flex-col gap-4">
      {MOMENTS_REPAS.filter((m) => entries.some((e) => e.moment === m)).map((moment) => {
        const duMoment = entries.filter((e) => e.moment === moment);
        const sousTotal = Math.round(duMoment.reduce((somme, e) => somme + e.nutrition.kcal, 0));
        const titreId = `${uid}-moment-${moment}`;
        return (
          <section key={moment} aria-labelledby={titreId} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 id={titreId} className="text-micro font-bold uppercase tracking-wide text-ink-3">
                {MOMENT_LABELS[moment]}
              </h3>
              <span className="text-caption font-semibold tabular-nums text-ink-2">
                {sousTotal.toLocaleString("fr-FR")} kcal
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {duMoment.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onOpen={onOpen} onDelete={onDelete} />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
    </div>
  );
}
