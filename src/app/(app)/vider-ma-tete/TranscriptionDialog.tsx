"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { dangerButton, input, primaryButton } from "@/lib/ui";

type Props = {
  open: boolean;
  /** Texte enregistré de la feuille. */
  texte: string;
  /** Appelé à la fermeture avec le texte du champ : l'appelant enregistre s'il a changé. */
  onFermer: (texte: string) => void;
  onSupprimer: () => void;
};

function Corps({ texte, onFermer, onSupprimer }: Omit<Props, "open">) {
  // Le champ garde ce qui est tapé : le composant n'existe que fenêtre ouverte, donc chaque
  // ouverture repart du texte enregistré.
  const [valeur, setValeur] = useState(texte);

  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur);
      showToast("Texte copié");
    } catch {
      showErrorToast("Copie impossible : sélectionne le texte à la main.");
    }
  }

  return (
    <Modal title="Texte de la feuille" onClose={() => onFermer(valeur)}>
      <div className="flex flex-col gap-3">
        <label htmlFor="texte-transcrit" className="sr-only">
          Texte transcrit
        </label>
        <textarea
          id="texte-transcrit"
          lang="fr"
          spellCheck
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          className={`${input} min-h-[40dvh] w-full resize-none text-[15.5px] leading-relaxed`}
        />
        <p className="text-[12.5px] leading-snug text-ink-2">
          Lu par Gemini : relis-le, des mots peuvent être faux. Tes corrections sont enregistrées en fermant.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={() => void copier()} className={primaryButton}>
            Copier
          </button>
          <button type="button" onClick={onSupprimer} className={dangerButton}>
            Supprimer le texte
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Texte transcrit d'une feuille : modifiable, copiable, supprimable sans toucher à l'écriture. */
export function TranscriptionDialog({ open, ...corps }: Props) {
  return <AnimatePresence>{open && <Corps key="texte" {...corps} />}</AnimatePresence>;
}
