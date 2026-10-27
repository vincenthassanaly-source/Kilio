"use client";

import { useId, useActionState, useEffect, useRef, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createListe, updateListe, type ListeFormState } from "@/app/actions/taches";
import { queryKeys } from "@/lib/query/keys";
import type { Tables } from "@/lib/supabase/types";
import { COULEUR_PAR_DEFAUT, errorText, input, label as labelClass, primaryButton } from "@/lib/ui";

const initialState: ListeFormState = { error: null };

export function AddListeForm({
  liste,
  onDone,
}: {
  liste?: Tables<"listes_taches">;
  onDone?: () => void;
}) {
  // Ids uniques par instance (T11) : formulaire rendu en ajout et en édition.
  const uid = useId();
  const action = liste ? updateListe : createListe;
  const queryClient = useQueryClient();
  const [state, formAction, pending] = useActionState(action, initialState);
  const prevPending = useRef(pending);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      // /taches lit listes et tâches via TanStack Query (30 s de fraîcheur).
      queryClient.invalidateQueries({ queryKey: queryKeys.listes });
      queryClient.invalidateQueries({ queryKey: queryKeys.taches });
      onDone?.();
    }
    prevPending.current = pending;
  }, [pending, state.error, onDone, queryClient]);

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
      {liste && <input type="hidden" name="id" value={liste.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-nom`} className={labelClass}>
          Nom
        </label>
        <input id={`${uid}-nom`} name="nom" required defaultValue={liste?.nom} className={input} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-couleur`} className={labelClass}>
          Couleur (optionnel)
        </label>
        <input
          id={`${uid}-couleur`}
          name="couleur"
          type="color"
          defaultValue={liste?.couleur ?? COULEUR_PAR_DEFAUT}
          className="h-10 w-16 rounded-lg border border-line bg-surface p-1"
        />
      </div>

      {state.error && (
        <p className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Enregistrement..." : liste ? "Enregistrer" : "Créer la liste"}
      </button>
    </form>
  );
}
