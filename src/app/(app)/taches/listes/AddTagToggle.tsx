"use client";

import { useState } from "react";
import { AddTagForm } from "./AddTagForm";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import { addCard, addCardIcon, addCardSousTitre, addCardTitre, card, textButton } from "@/lib/ui";
import { PlusIcon } from "@/components/icons";

export function AddTagToggle() {
  const [open, setOpen] = useState(false);
  useBackClose(open, () => setOpen(false));

  const trigger = (
    <button type="button" onClick={() => setOpen(true)} className={addCard}>
      <div
        className={addCardIcon}
      >
        <PlusIcon size={18} />
      </div>
      <div className="flex flex-col gap-[1px]">
        <span className={addCardTitre}>Ajouter un tag</span>
        <span className={addCardSousTitre}>Un tag pour classer tes tâches</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <div className={card}>
        <AddTagForm onDone={() => setOpen(false)} />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${textButton} mt-2`}
        >
          Annuler
        </button>
      </div>
    </AnimatedAddCard>
  );
}
