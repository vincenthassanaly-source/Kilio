"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { dangerButton, input, primaryButton, secondaryButton } from "@/lib/ui";

type Props = {
  open: boolean;
  /**
   * « proposition » : texte qui vient d'être transcrit, à relire puis valider (fermer sans valider
   * ne change rien). « texte » : texte du jour déjà validé, modifiable.
   */
  mode: "proposition" | "texte";
  texte: string;
  /** Appelé à la fermeture avec le texte du champ : en mode « texte », l'appelant enregistre s'il a changé. */
  onFermer: (texte: string) => void;
  /** Mode « proposition » : ajoute le texte (corrigé) au texte du jour et vide la feuille. */
  onValider: (texte: string) => Promise<void>;
  /** Mode « texte » : supprimer le texte du jour. */
  onSupprimer: () => void;
};

function Corps({ mode, texte, onFermer, onValider, onSupprimer }: Omit<Props, "open">) {
  // Le champ garde ce qui est tapé : le composant n'existe que fenêtre ouverte, donc chaque
  // ouverture repart du texte enregistré.
  const [valeur, setValeur] = useState(texte);
  const [enCours, setEnCours] = useState(false);
  const proposition = mode === "proposition";

  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur);
      showToast("Texte copié");
    } catch {
      showErrorToast("Copie impossible : sélectionne le texte à la main.");
    }
  }

  async function valider() {
    setEnCours(true);
    try {
      await onValider(valeur);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal title={proposition ? "Texte transcrit" : "Texte du jour"} onClose={() => onFermer(valeur)}>
      <div className="flex flex-col gap-3">
        <label htmlFor="texte-transcrit" className="sr-only">
          {proposition ? "Texte transcrit" : "Texte du jour"}
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
          {proposition
            ? "Lu par Gemini : relis-le, des mots peuvent être faux. En validant, il rejoint le texte du jour et la feuille est vidée, sans retour possible. En fermant sans valider, rien ne change."
            : "Tes corrections sont enregistrées en fermant."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {proposition ? (
            <>
              <button type="button" onClick={() => void copier()} className={secondaryButton}>
                Copier
              </button>
              <button type="button" onClick={() => void valider()} disabled={enCours || valeur.trim() === ""} className={primaryButton}>
                Valider
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => void copier()} className={primaryButton}>
                Copier
              </button>
              <button type="button" onClick={onSupprimer} className={dangerButton}>
                Supprimer le texte
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Texte transcrit à valider, ou texte du jour : modifiable, copiable, supprimable sans toucher à l'écriture. */
export function TranscriptionDialog({ open, ...corps }: Props) {
  return <AnimatePresence>{open && <Corps key={corps.mode} {...corps} />}</AnimatePresence>;
}
