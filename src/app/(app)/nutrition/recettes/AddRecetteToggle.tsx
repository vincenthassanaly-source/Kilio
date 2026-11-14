"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import { addCard, addCardIcon, card, textButton } from "@/lib/ui";
import { PlusIcon } from "@/components/icons";

const RecetteForm = dynamic(() => import("./RecetteForm").then((m) => m.RecetteForm), { ssr: false });

export function AddRecetteToggle() {
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
        <span className="font-display text-body font-semibold tracking-[-0.01em] text-ink">Ajouter une recette</span>
        <span className="text-xs font-medium text-ink-3">Une recette avec ses ingrédients et ses étapes</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <div className={card}>
        <RecetteForm />
        <button type="button" onClick={() => setOpen(false)} className={`mt-2 ${textButton}`}>
          Annuler
        </button>
      </div>
    </AnimatedAddCard>
  );
}
