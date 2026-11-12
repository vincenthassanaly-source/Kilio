"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Tables } from "@/lib/supabase/types";
import { deleteCourseItems, type CourseItemARestaurer } from "@/app/actions/courses";
import { queryKeys } from "@/lib/query/keys";
import { showActionToast, showToast } from "@/components/toast/toast-store";
import { enqueueAction, isNetworkError } from "@/lib/offline/queue";
import { restaurerArticlesCourses } from "./undo";
import { CourseItemRow } from "./CourseItemRow";
import { card, ghostButton, sectionTitle } from "@/lib/ui";

function versSnapshot(item: Tables<"courses_items">): CourseItemARestaurer {
  return {
    id: item.id,
    libelle: item.libelle,
    coche: item.coche,
    created_at: item.created_at,
    termine_le: item.termine_le,
  };
}

export function ArchivedCoursesSection({ items }: { items: Tables<"courses_items">[] }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const queryClient = useQueryClient();

  // Bouton « Vider les cochés » : les ids exacts des articles archivés
  // affichés (jamais un `where coche = true` côté serveur), pour que
  // « Annuler » restaure précisément le même ensemble, même si un autre
  // article a été coché entre-temps. `networkMode: "always"` : même motif
  // que CourseItemRow (voir son commentaire), pour que la mutation
  // s'exécute réellement hors ligne et rejoigne la file plutôt que de rester
  // en pause.
  const viderMutation = useMutation({
    networkMode: "always",
    mutationFn: async (snapshot: CourseItemARestaurer[]) => {
      const ids = snapshot.map((item) => item.id);
      try {
        await deleteCourseItems(ids);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueAction("courses", "deleteCourseItems", [ids]);
      }
    },
    onMutate: async (snapshot) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courses });
      const previous = queryClient.getQueryData<Tables<"courses_items">[]>(queryKeys.courses);
      const ids = new Set(snapshot.map((item) => item.id));
      queryClient.setQueryData<Tables<"courses_items">[]>(queryKeys.courses, (old) =>
        old?.filter((i) => !ids.has(i.id))
      );
      return { previous };
    },
    onSuccess: (_data, snapshot) => {
      const n = snapshot.length;
      showActionToast(`${n} article${n > 1 ? "s" : ""} supprimé${n > 1 ? "s" : ""}`, {
        ariaLabel: `Annuler la suppression de ${n} article${n > 1 ? "s" : ""}`,
        onAction: () => restaurerArticlesCourses(queryClient, snapshot),
      });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.courses, context.previous);
      showToast("Impossible de supprimer les articles cochés.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.courses }),
  });

  if (items.length === 0) return null;

  function handleVider() {
    if (items.length === 0) return;
    viderMutation.mutate(items.map(versSnapshot));
  }

  return (
    <div className={card}>
      {/* Deux contrôles distincts côte à côte (pas de <button> imbriqué dans
          un autre) : le dépliage à gauche, « Vider les cochés » à droite —
          visible même section repliée, pour vider en sortant du magasin
          sans avoir à déplier. */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 items-center gap-1.5"
          aria-expanded={open}
        >
          <span className={sectionTitle}>Articles archivés (<span className="tabular-nums">{items.length}</span>)</span>
          <span
            className={`text-ink-2 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▾
          </span>
        </button>
        <button
          type="button"
          onClick={handleVider}
          disabled={viderMutation.isPending}
          className={ghostButton}
        >
          Vider les cochés
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <ul className="mt-2.5 flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <CourseItemRow key={item.id} item={item} plat />
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
