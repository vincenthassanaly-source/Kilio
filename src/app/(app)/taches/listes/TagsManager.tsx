"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { deleteTag } from "@/app/actions/taches";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, ghostButton, listCard, nameText } from "@/lib/ui";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { useMasques } from "@/lib/actions/elementsMasques";
import { AddTagForm } from "./AddTagForm";

function TagRow({ tag }: { tag: Tables<"tags"> }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  if (editing) {
    return (
      <li className={listCard}>
        <AddTagForm tag={tag} onDone={() => setEditing(false)} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-label text-ink-2 underline">
            Annuler
          </button>
          <button
            type="button"
            onClick={() =>
              // Suppression différée : le tag disparaît tout de suite, « Annuler »
              // le ramène (avec ses tâches associées, intactes) pendant le délai.
              supprimerAvecAnnulation({
                texte: `Tag « #${tag.nom} » supprimé`,
                ariaLabel: `Annuler la suppression du tag « #${tag.nom} »`,
                masque: { type: "tag", id: tag.id },
                masquer: () => setEditing(false),
                supprimer: () => deleteTag(tag.id),
                erreur: `Impossible de supprimer le tag « #${tag.nom} ». Réessaie.`,
                onSupprime: () => {
                  queryClient.invalidateQueries({ queryKey: queryKeys.tags });
                  queryClient.invalidateQueries({ queryKey: queryKeys.taches });
                },
              })
            }
            className={dangerButton}
          >
            Supprimer
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={`${listCard} flex-row items-center justify-between`}>
      <div className="flex min-w-0 items-center gap-2">
        {tag.couleur && (
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.couleur }} aria-hidden="true" />
        )}
        <p className={nameText}>#{tag.nom}</p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
        Modifier
      </button>
    </li>
  );
}

export function TagsManager({ tags }: { tags: Tables<"tags">[] }) {
  // Tags en cours de suppression (toast « Annuler » encore affiché) : cachés.
  const masques = useMasques("tag");
  const visibles = tags.filter((t) => !masques.has(t.id));
  if (visibles.length === 0) {
    return <p className="text-ink-2">Aucun tag pour l&apos;instant.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {visibles.map((tag) => (
        <TagRow key={tag.id} tag={tag} />
      ))}
    </ul>
  );
}
