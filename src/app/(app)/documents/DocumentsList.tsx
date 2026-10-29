"use client";

import { AnimatePresence } from "framer-motion";
import type { DocumentAvecFichiers } from "@/app/actions/documents";
import { DocumentCard } from "./DocumentCard";

export function DocumentsList({
  documents,
  categories,
  emptyMessage = "Aucun document pour l'instant.",
}: {
  documents: DocumentAvecFichiers[];
  categories: string[];
  emptyMessage?: string;
}) {
  if (documents.length === 0) {
    return <p className="text-ink-2">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {documents.map((document) => (
          <DocumentCard key={document.id} document={document} categories={categories} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
