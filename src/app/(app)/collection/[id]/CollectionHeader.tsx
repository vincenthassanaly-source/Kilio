"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteCollection, renameCollection } from "@/app/actions/collections";
import { queryKeys } from "@/lib/query/keys";
import { runAction } from "@/lib/actions/runAction";
import { useBackClose } from "@/hooks/useBackClose";
import type { Tables } from "@/lib/supabase/types";
import { dangerButton, errorText, ghostButton, input } from "@/lib/ui";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
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
      // Contrat T1 : message lisible (celui d'une exception de Server Action
      // est masqué en production), affiché en ligne sous l'en-tête.
      const res = await runAction(() => renameCollection(collection.id, trimmed), {
        erreur: "Le renommage a échoué. Réessaie.",
        silencieux: true,
        onError: setError,
      });
      if (!res.ok) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.collection(collection.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections });
      setEditing(false);
    });
  }

  // Suppression différée : la collection disparaît tout de suite (retour à la
  // liste, où elle est masquée), « Annuler » la ramène pendant le délai du toast.
  // La Server Action (qui supprime aussi les photos du stockage) ne part qu'après
  // ce délai ; elle part même si on quitte l'écran entre-temps.
  function handleDelete() {
    setError(null);
    supprimerAvecAnnulation({
      texte: `Collection « ${collection.nom} » supprimée`,
      ariaLabel: `Annuler la suppression de la collection « ${collection.nom} »`,
      masque: { type: "collection", id: collection.id },
      masquer: () => router.push("/collection"),
      supprimer: () => deleteCollection(collection.id),
      erreur: `Impossible de supprimer la collection « ${collection.nom} ». Réessaie.`,
      onSupprime: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.collections });
        queryClient.invalidateQueries({ queryKey: queryKeys.collection(collection.id) });
      },
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
              aria-label="Nom de la collection"
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
            className="mt-1 truncate font-display text-heading font-semibold text-ink"
          >
            {collection.nom}
          </h1>
        )}

        <div className="flex shrink-0 gap-2">
          {!editing && (
            <button type="button" onClick={() => {
                // Repart du nom actuel, pas d'un brouillon abandonné ou périmé.
                setNom(collection.nom);
                setEditing(true);
              }} className={ghostButton}>
              Renommer
            </button>
          )}
          <button type="button" disabled={isPending} onClick={handleDelete}
            aria-label="Supprimer la collection"
            className={dangerButton}
          >
            Supprimer
          </button>
        </div>
      </div>

      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}
