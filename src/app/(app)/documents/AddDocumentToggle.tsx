"use client";

import dynamic from "next/dynamic";
import { AddCardToggle } from "@/components/AddCardToggle";

const DocumentForm = dynamic(() => import("./DocumentForm").then((m) => m.DocumentForm), { ssr: false });

export function AddDocumentToggle({ categories }: { categories: string[] }) {
  return (
    <AddCardToggle titre="Ajouter un document" sousTitre="Une photo ou un PDF">
      {(fermer) => <DocumentForm categories={categories} onDone={fermer} />}
    </AddCardToggle>
  );
}
