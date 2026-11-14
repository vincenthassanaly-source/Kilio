"use client";

import { AnimatePresence } from "framer-motion";
import type { DocumentAvecFichiers } from "@/app/actions/documents";
import { card } from "@/lib/ui";
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
    return (
      <div className={`${card} flex flex-col items-center gap-2 py-8 text-center`}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3.5h9l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" />
          <path d="M9 13h6M9 16.5h4" />
        </svg>
        <p className="text-body font-bold text-ink text-balance">{emptyMessage}</p>
        <p className="text-sm text-ink-2 text-pretty">Ajoute une photo ou un PDF avec le bouton ci-dessus.</p>
      </div>
    );
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
