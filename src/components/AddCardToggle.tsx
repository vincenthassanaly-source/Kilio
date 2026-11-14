"use client";

import { useState, type ReactNode } from "react";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import { addCard, addCardIcon, card, textButton } from "@/lib/ui";
import { PlusIcon } from "@/components/icons";

// Carte « + Ajouter … » qui se déplie en formulaire (carte + animation +
// retour arrière + bouton Annuler). Partagée par AddDocumentToggle et
// AddNoteToggle ; `children` reçoit la fonction qui referme la carte.
export function AddCardToggle({
  titre,
  sousTitre,
  defaultOpen = false,
  annulerClassName = textButton,
  children,
}: {
  titre: string;
  sousTitre: string;
  defaultOpen?: boolean;
  annulerClassName?: string;
  children: (fermer: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useBackClose(open, () => setOpen(false));
  const fermer = () => setOpen(false);

  const trigger = (
    <button type="button" onClick={() => setOpen(true)} className={addCard}>
      <div className={addCardIcon}>
        <PlusIcon size={18} />
      </div>
      <div className="flex flex-col gap-[1px]">
        <span className="font-display text-body font-semibold tracking-[-0.01em] text-ink">{titre}</span>
        <span className="text-xs font-medium text-ink-3">{sousTitre}</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <div className={card}>
        {children(fermer)}
        <button type="button" onClick={fermer} className={annulerClassName}>
          Annuler
        </button>
      </div>
    </AnimatedAddCard>
  );
}
