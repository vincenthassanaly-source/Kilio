"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Nutrition } from "@/lib/nutrition/compute";
import type { Enums } from "@/lib/supabase/types";
import { cardTight, dangerButton } from "@/lib/ui";

export type JournalEntryView = {
  id: string;
  moment: Enums<"moment_repas">;
  label: string;
  detail: string;
  nutrition: Nutrition;
};

const MOMENT_ORDER: Enums<"moment_repas">[] = ["petit_dej", "dejeuner", "diner", "collation"];
const MOMENT_LABEL: Record<string, string> = {
  petit_dej: "Petit-déj",
  dejeuner: "Déjeuner",
  diner: "Dîner",
  collation: "Collation",
};

function EntryRow({ entry, onDelete }: { entry: JournalEntryView; onDelete: (id: string) => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={`${cardTight} flex flex-col gap-2`}
    >
      <span className="text-micro font-bold uppercase tracking-wide text-ink-3">
        {MOMENT_LABEL[entry.moment]}
      </span>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body font-semibold text-ink">{entry.label}</p>
          <p className="text-xs text-ink-2">{entry.detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-body font-semibold text-ink">
            {Math.round(entry.nutrition.kcal)} kcal
          </span>
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
            className={dangerButton}
          >
            Suppr.
          </button>
        </div>
      </div>
    </motion.li>
  );
}

// Liste des repas du jour, présentationnelle : l'état « masqué » (suppression
// annulable en cours) vit dans JournalRepas, qui calcule aussi le résumé sur
// les repas visibles.
export function JournalEntriesList({
  entries,
  onDelete,
}: {
  entries: JournalEntryView[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {MOMENT_ORDER.filter((m) => entries.some((e) => e.moment === m)).map((moment) => (
        <ul key={moment} className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {entries
              .filter((e) => e.moment === moment)
              .map((entry) => (
                <EntryRow key={entry.id} entry={entry} onDelete={onDelete} />
              ))}
          </AnimatePresence>
        </ul>
      ))}
    </div>
  );
}
