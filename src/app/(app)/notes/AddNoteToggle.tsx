"use client";

import dynamic from "next/dynamic";
import type { Tables } from "@/lib/supabase/types";
import { AddCardToggle } from "@/components/AddCardToggle";
import { textButton } from "@/lib/ui";

const NoteForm = dynamic(() => import("./NoteForm").then((m) => m.NoteForm), { ssr: false });

export function AddNoteToggle({
  tags,
  defaultOpen = false,
  onSaved,
}: {
  tags: Tables<"tags">[];
  defaultOpen?: boolean;
  onSaved?: () => void;
}) {
  return (
    <AddCardToggle
      titre="Ajouter une note"
      sousTitre="Une note libre, avec ou sans liste"
      defaultOpen={defaultOpen}
      annulerClassName={`${textButton} mt-2`}
    >
      {(fermer) => (
        <NoteForm
          tags={tags}
          onDone={() => {
            fermer();
            onSaved?.();
          }}
        />
      )}
    </AddCardToggle>
  );
}
