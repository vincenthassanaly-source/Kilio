"use client";

import { useState } from "react";
import { AddEtiquetteForm } from "./AddEtiquetteForm";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import { addCard, addCardIcon, card } from "@/lib/ui";

export function AddEtiquetteToggle() {
  const [open, setOpen] = useState(false);
  useBackClose(open, () => setOpen(false));

  const trigger = (
    <button type="button" onClick={() => setOpen(true)} className={addCard}>
      <div
        className={addCardIcon}
      >
        +
      </div>
      <div className="flex flex-col gap-[1px]">
        <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Ajouter une étiquette
        </span>
        <span className="text-xs font-medium text-ink-3">Nouveau type de document</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <div className={card}>
        <AddEtiquetteForm onDone={() => setOpen(false)} />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-2 text-sm text-ink-2 underline"
        >
          Annuler
        </button>
      </div>
    </AnimatedAddCard>
  );
}
