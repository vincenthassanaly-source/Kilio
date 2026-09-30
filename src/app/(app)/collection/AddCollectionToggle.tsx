"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createCollection, type CollectionFormState } from "@/app/actions/collections";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import { addCard, addCardIcon, card, errorText, input, primaryButton } from "@/lib/ui";

const initialState: CollectionFormState = { error: null };

export function AddCollectionToggle({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCollection, initialState);
  const prevPending = useRef(pending);
  useBackClose(open, () => setOpen(false));

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      setOpen(false);
      onSaved?.();
    }
    prevPending.current = pending;
  }, [pending, state.error, onSaved]);

  const trigger = (
    <button type="button" onClick={() => setOpen(true)} className={addCard}>
      <div
        className={addCardIcon}
      >
        +
      </div>
      <div className="flex flex-col gap-[1px]">
        <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">Nouvelle collection</span>
        <span className="text-xs font-medium text-ink-3">Nouveau classeur</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <form action={formAction} className={`${card} flex flex-col gap-3`}>
        <input name="nom" autoFocus required placeholder="Nom de la collection" className={input} />

        {state.error && (
          <p className={errorText} role="alert">
            {state.error}
          </p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Création..." : "Créer"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-2 underline">
            Annuler
          </button>
        </div>
      </form>
    </AnimatedAddCard>
  );
}
