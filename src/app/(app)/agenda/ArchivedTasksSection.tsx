"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TacheAvecRelations } from "@/app/actions/taches";
import type { Tables } from "@/lib/supabase/types";
import { TaskCard } from "../taches/TasksList";
import { card, sectionTitle } from "@/lib/ui";

export function ArchivedTasksSection({
  taches,
  listes,
  tags,
  tacheEnSurbrillanceId = null,
}: {
  taches: TacheAvecRelations[];
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  // Cf. DayView : si la tâche ciblée par le deep-link de notification est
  // archivée, la section (repliée par défaut) s'ouvre déjà dépliée pour
  // qu'elle soit visible et scrollable en vue.
  tacheEnSurbrillanceId?: string | null;
}) {
  const [open, setOpen] = useState(
    () => tacheEnSurbrillanceId !== null && taches.some((t) => t.id === tacheEnSurbrillanceId)
  );

  if (taches.length === 0) return null;

  return (
    <div className={card}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        aria-expanded={open}
      >
        <span className={sectionTitle}>Tâches archivées ({taches.length})</span>
        <span
          className={`text-ink-2 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="mt-2.5 flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {taches.map((tache) => (
                  <TaskCard
                    key={tache.id}
                    tache={tache}
                    listes={listes}
                    tags={tags}
                    colorByListe
                    highlighted={tache.id === tacheEnSurbrillanceId}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
