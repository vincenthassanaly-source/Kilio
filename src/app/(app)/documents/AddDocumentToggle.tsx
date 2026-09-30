"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useBackClose } from "@/hooks/useBackClose";
import { AnimatedAddCard } from "@/components/AnimatedAddCard";
import type { Tables } from "@/lib/supabase/types";
import { addCard, addCardIcon, card } from "@/lib/ui";

const DocumentForm = dynamic(() => import("./DocumentForm").then((m) => m.DocumentForm), { ssr: false });

export function AddDocumentToggle({
  etiquettes,
}: {
  etiquettes: Tables<"etiquettes">[];
}) {
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
          Ajouter un document
        </span>
        <span className="text-xs font-medium text-ink-3">Photo ou PDF, échéance optionnelle</span>
      </div>
    </button>
  );

  return (
    <AnimatedAddCard open={open} trigger={trigger}>
      <div className={card}>
        <DocumentForm etiquettes={etiquettes} onDone={() => setOpen(false)} />
        <button type="button" onClick={() => setOpen(false)} className="mt-2 text-sm text-ink-2 underline">
          Annuler
        </button>
      </div>
    </AnimatedAddCard>
  );
}
