"use client";

import { useState } from "react";
import { AddListeForm } from "./AddListeForm";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import { addCard, addCardIcon, addCardSousTitre, addCardTitre, card, textButton } from "@/lib/ui";
import { PlusIcon } from "@/components/icons";

export function AddListeToggle() {
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
        <span className={addCardTitre}>Ajouter une liste</span>
        <span className={addCardSousTitre}>Une liste pour regrouper des tâches</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <div className={card}>
        <AddListeForm onDone={() => setOpen(false)} />
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
