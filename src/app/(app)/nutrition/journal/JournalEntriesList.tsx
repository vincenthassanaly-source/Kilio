"use client";

import { useOptimistic, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { removeJournalEntry } from "@/app/actions/journal";
import { showToast } from "@/components/toast/toast-store";
import { queryKeys } from "@/lib/query/keys";
import type { Nutrition } from "@/lib/nutrition/compute";
import type { Enums } from "@/lib/supabase/types";
import { cardTight, dangerButton } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";

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
            onClick={async () => {
              if (!(await confirmDelete(`Supprimer « ${entry.label} » du journal ?`))) return;
              onDelete(entry.id);
            }}
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

// Suppression optimiste sans TanStack Query : la page reste un Server
// Component (navigation entre jours pilotée par l'URL, déjà instantanée via
// le prefetch de <Link>), donc `useOptimistic` + Server Action suffit ici —
// masquage immédiat de la ligne, réconcilié par les nouvelles props une fois
// `removeJournalEntry` (qui appelle revalidatePath) effectivement résolue.
export function JournalEntriesList({ entries }: { entries: JournalEntryView[] }) {
  const [optimisticEntries, removeOptimistic] = useOptimistic(entries, (state, id: string) =>
    state.filter((e) => e.id !== id)
  );
  const [, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function handleDelete(id: string) {
    startTransition(async () => {
      removeOptimistic(id);
      const entry = entries.find((e) => e.id === id);
      try {
        await removeJournalEntry(id);
        // Même invalidation que le chemin "ajout" (useAjoutRepasTermine) :
        // sans ça, la carte nutrition du dashboard et le catalogue
        // "Récents" continuent de compter ce repas jusqu'à 30s après sa
        // suppression (CLICK-PATH-202).
        queryClient.invalidateQueries({ queryKey: queryKeys.catalogueJournal });
        queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
      } catch {
        // Nomme l'élément et la marche à suivre (clarify.md : un échec doit
        // dire quoi a échoué et comment récupérer) : la ligne réapparaît
        // d'elle-même une fois `useOptimistic` retombé sur les props réelles
        // (non rafraîchies puisque `revalidatePath` n'a pas été appelé côté
        // serveur), donc retaper "Suppr." suffit à réessayer.
        showToast(
          entry ? `Impossible de supprimer « ${entry.label} ». Réessaie.` : "Impossible de supprimer ce repas. Réessaie."
        );
      }
    });
  }

  if (optimisticEntries.length === 0) {
    return <p className="text-ink-2">Aucun repas enregistré pour ce jour.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {MOMENT_ORDER.filter((m) => optimisticEntries.some((e) => e.moment === m)).map((moment) => (
        <ul key={moment} className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {optimisticEntries
              .filter((e) => e.moment === moment)
              .map((entry) => (
                <EntryRow key={entry.id} entry={entry} onDelete={handleDelete} />
              ))}
          </AnimatePresence>
        </ul>
      ))}
    </div>
  );
}
