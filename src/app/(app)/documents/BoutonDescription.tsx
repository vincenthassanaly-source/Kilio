"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { DocumentAvecFichiers } from "@/app/actions/documents";
import { DescriptionModal } from "./DescriptionModal";

// Bouton icône, même gabarit que « Remettre en vrac » : 36 px visibles, zone de
// toucher étendue à 44 px. Le libellé reste disponible pour les lecteurs d'écran
// (aria-label, avec le nom du document) et en info-bulle (title).
const ICONE =
  "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 transition active:scale-[0.97] hover:bg-surface-alt hover:text-ink after:absolute after:-inset-1 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

// Mêmes étincelles que « Réorganiser » : le symbole des fonctions IA de l'app.
function EtincelleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

/**
 * Bouton « Description par l'IA » d'un document : ouvre une fenêtre où Gemini
 * résume le document. Absent quand le document n'a aucun fichier à lire.
 */
export function BoutonDescription({ document }: { document: DocumentAvecFichiers }) {
  const [ouvert, setOuvert] = useState(false);
  if (document.fichiers.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        aria-label={`Description de « ${document.nom} »`}
        title="Description par l'IA"
        className={ICONE}
      >
        <EtincelleIcon />
      </button>
      <AnimatePresence>
        {ouvert && (
          <DescriptionModal documentId={document.id} nom={document.nom} onClose={() => setOuvert(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
