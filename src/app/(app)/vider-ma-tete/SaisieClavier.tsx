"use client";

import { useState } from "react";
import { input, primaryButton } from "@/lib/ui";

type Props = {
  /** Ajoute la note au texte du jour ; renvoie vrai si elle a été enregistrée (le champ se vide alors). */
  onAjouter: (texte: string) => Promise<boolean>;
};

/**
 * Saisie au clavier du téléphone, à la place de la feuille de stylo. Rien n'est gardé tant que
 * « Ajouter » n'a pas été touché : le texte rejoint alors celui du jour, avec l'heure.
 */
export function SaisieClavier({ onAjouter }: Props) {
  const [valeur, setValeur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function ajouter() {
    setEnCours(true);
    try {
      if (await onAjouter(valeur)) setValeur("");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="saisie-clavier" className="sr-only">
        Ce que tu as en tête
      </label>
      <textarea
        id="saisie-clavier"
        lang="fr"
        spellCheck
        autoComplete="off"
        enterKeyHint="enter"
        placeholder="Écris ici ce que tu as en tête…"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        className={`${input} min-h-[34dvh] w-full resize-none leading-relaxed`}
      />
      <button type="button" onClick={() => void ajouter()} disabled={enCours || valeur.trim() === ""} className={primaryButton}>
        {enCours ? "Ajout…" : "Ajouter"}
      </button>
      <p className="text-[12.5px] leading-snug text-ink-2">
        Ton texte rejoint celui de la journée, avec l&apos;heure. Il n&apos;est gardé qu&apos;une fois « Ajouter » touché.
      </p>
    </div>
  );
}
