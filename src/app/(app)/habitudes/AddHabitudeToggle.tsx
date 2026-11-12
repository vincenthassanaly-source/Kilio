"use client";

import { useState } from "react";
import { HabitudeForm } from "./HabitudeForm";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import { addCard, addCardIcon, card, textButton } from "@/lib/ui";

export function AddHabitudeToggle({ onSaved }: { onSaved?: () => void }) {
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
        <span className="font-display text-body font-semibold tracking-[-0.01em] text-ink">Ajouter une habitude</span>
        <span className="text-xs font-medium text-ink-3">Nouveau suivi quotidien</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <div className={card}>
        <HabitudeForm
          onDone={() => {
            setOpen(false);
            onSaved?.();
          }}
        />
        <button type="button" onClick={() => setOpen(false)} className={`mt-2 ${textButton}`}>
          Annuler
        </button>
      </div>
    </AnimatedAddCard>
  );
}
