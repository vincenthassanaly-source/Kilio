"use client";

import { useState } from "react";
import { AddCourseForm } from "./AddCourseForm";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import { addCard, addCardIcon, card } from "@/lib/ui";

export function AddCourseToggle() {
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
        <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">Ajouter un article</span>
        <span className="text-xs font-medium text-ink-3">Nouvel article à la liste</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <div className={card}>
        <AddCourseForm />
        {/* Le formulaire reste ouvert après chaque ajout (#1) : ce bouton
            est désormais la seule façon de refermer la carte volontairement
            (avec le retour, via useBackClose ci-dessus) — "Fermer" plutôt
            que "Annuler", puisqu'il n'annule plus rien en cours. */}
        <button type="button" onClick={() => setOpen(false)} className="mt-2 text-sm text-ink-2 underline">
          Fermer
        </button>
      </div>
    </AnimatedAddCard>
  );
}
