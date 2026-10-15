"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { deleteTag } from "@/app/actions/taches";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, listCard, nameText } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";
import { runAction } from "@/lib/actions/runAction";

function TagRow({ tag }: { tag: Tables<"tags"> }) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  return (
    <li className={`${listCard} flex-row items-center justify-between`}>
      <div className="flex items-center gap-2">
        {tag.couleur && (
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.couleur }} />
        )}
        <p className={nameText}>#{tag.nom}</p>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirmDelete(`Supprimer le tag « #${tag.nom} » ?`)) return;
          startTransition(async () => {
            await runAction(() => deleteTag(tag.id), { erreur: `Impossible de supprimer l'étiquette « ${tag.nom} ». Réessaie.` });
            queryClient.invalidateQueries({ queryKey: queryKeys.tags });
            queryClient.invalidateQueries({ queryKey: queryKeys.taches });
          });
        }}
        className={dangerButton}
      >
        Suppr.
      </button>
    </li>
  );
}

export function TagsManager({ tags }: { tags: Tables<"tags">[] }) {
  if (tags.length === 0) {
    return <p className="text-ink-2">Aucun tag pour l&apos;instant.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {tags.map((tag) => (
        <TagRow key={tag.id} tag={tag} />
      ))}
    </ul>
  );
}
