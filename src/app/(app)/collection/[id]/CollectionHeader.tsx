"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteCollection, renameCollection } from "@/app/actions/collections";
import { queryKeys } from "@/lib/query/keys";
import { useBackClose } from "@/hooks/useBackClose";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, errorText, ghostButton, input } from "@/lib/ui";
import { confirmDelete } from "@/lib/confirm";
import { BackLink } from "@/components/BackLink";

export function CollectionHeader({ collection }: { collection: Tables<"collections"> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(collection.nom);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Cohérent avec NoteCard/AddCollectionToggle : le bouton/geste retour ferme
  // le formulaire de renommage plutôt que de quitter la page en abandonnant
  // silencieusement la saisie en cours (CLICK-PATH-604).
  useBackClose(editing, () => setEditing(false));

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nom.trim();
    if (!trimmed) return;

    setError(null);
    startTransition(async () => {
      try {
        await renameCollection(collection.id, trimmed);
        queryClient.invalidateQueries({ queryKey: queryKeys.collection(collection.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.collections });
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue.");
      }
    });
  }

  function handleDelete() {
    if (!confirmDelete(`Supprimer la collection « ${collection.nom} » et toutes ses photos ?`)) return;

    setError(null);
    startTransition(async () => {
      try {
        await deleteCollection(collection.id);
        queryClient.invalidateQueries({ queryKey: queryKeys.collections });
        router.push("/collection");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <BackLink href="/collection">Collection</BackLink>

      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <form onSubmit={handleRename} className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={`${input} flex-1`}
            />
            <button type="submit" disabled={isPending} className={ghostButton}>
              OK
            </button>
          </form>
        ) : (
          <h1
            style={{ viewTransitionName: `collection-title-${collection.id}` }}
            className="mt-1 truncate font-display text-[22px] font-semibold text-ink"
          >
            {collection.nom}
          </h1>
        )}

        <div className="flex shrink-0 gap-2">
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
              Renommer
            </button>
          )}
          <button type="button" disabled={isPending} onClick={handleDelete} className={dangerButton}>
            Suppr.
          </button>
        </div>
      </div>

      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}
