"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { DocumentAvecFichiers } from "@/app/actions/documents";
import { ghostButton } from "@/lib/ui";
import { DescriptionModal } from "./DescriptionModal";

/**
 * Bouton « Description » d'un document : ouvre une fenêtre où Gemini résume le
 * document. Absent quand le document n'a aucun fichier à lire.
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
        className={ghostButton}
      >
        Description
      </button>
      <AnimatePresence>
        {ouvert && (
          <DescriptionModal documentId={document.id} nom={document.nom} onClose={() => setOuvert(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
