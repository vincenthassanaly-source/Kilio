"use client";

import { useId, useActionState, useEffect, useRef, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createTag, updateTag, type TagFormState } from "@/app/actions/taches";
import { queryKeys } from "@/lib/query/keys";
import type { Tables } from "@/lib/supabase/types";
import { errorText, input, label as labelClass, primaryButton } from "@/lib/ui";
import { CouleurPicker } from "./CouleurPicker";

const initialState: TagFormState = { error: null };

export function AddTagForm({ tag, onDone }: { tag?: Tables<"tags">; onDone?: () => void }) {
  // Ids uniques par instance (T11) : formulaire rendu en ajout et en édition.
  const uid = useId();
  const queryClient = useQueryClient();
  const [state, formAction, pending] = useActionState(tag ? updateTag : createTag, initialState);
  const prevPending = useRef(pending);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      // Un renommage ou une nouvelle couleur se voient aussi sur les cartes.
      if (tag) queryClient.invalidateQueries({ queryKey: queryKeys.taches });
      onDone?.();
    }
    prevPending.current = pending;
  }, [pending, state.error, onDone, queryClient, tag]);

  // <form onSubmit> plutôt que <form action> : React 19 réinitialise les champs
  // non contrôlés d'un formulaire à action même quand elle renvoie une erreur
  // (la saisie serait perdue). formAction reste appelé dans une transition.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {tag && <input type="hidden" name="id" value={tag.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-nom`} className={labelClass}>
          Nom
        </label>
        <input id={`${uid}-nom`} name="nom" required defaultValue={tag?.nom} className={input} />
      </div>

      <CouleurPicker defaultValue={tag?.couleur} />

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Enregistrement..." : tag ? "Enregistrer" : "Ajouter"}
      </button>
    </form>
  );
}
