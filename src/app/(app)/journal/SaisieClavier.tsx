"use client";

import { useState } from "react";
import { input, primaryButton } from "@/lib/ui";
import { ecrireBrouillon, lireBrouillon } from "./brouillonClavier";

type Props = {
  /** Jour de la feuille (`AAAA-MM-JJ`) : le brouillon en mémoire est rattaché à ce jour. */
  jour: string;
  /** Ajoute la note au texte du jour ; renvoie vrai si elle a été enregistrée (le champ se vide alors). */
  onAjouter: (texte: string) => Promise<boolean>;
};

/**
 * Saisie au clavier du téléphone, à la place de la feuille de stylo. Rien n'est enregistré tant que
 * « Ajouter » n'a pas été touché : le texte rejoint alors celui du jour, avec l'heure. Le texte tapé
 * reste en mémoire (jamais dans le stockage du navigateur) pour survivre à la bascule Stylo/Clavier
 * et au reverrouillage ; il est vidé une fois la note ajoutée.
 */
export function SaisieClavier({ jour, onAjouter }: Props) {
  const [valeur, setValeur] = useState(() => lireBrouillon(jour));
  const [enCours, setEnCours] = useState(false);

  function modifier(texte: string) {
    setValeur(texte);
    ecrireBrouillon(jour, texte);
  }

  async function ajouter() {
    setEnCours(true);
    try {
      if (await onAjouter(valeur)) modifier("");
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
        onChange={(e) => modifier(e.target.value)}
        className={`${input} min-h-[34dvh] w-full resize-none leading-relaxed`}
      />
      <button type="button" onClick={() => void ajouter()} disabled={enCours || valeur.trim() === ""} className={primaryButton}>
        {enCours ? "Ajout…" : "Ajouter"}
      </button>
      <p className="text-small leading-snug text-ink-2">
        Ton texte rejoint celui de la journée, avec l&apos;heure. Il n&apos;est gardé qu&apos;une fois « Ajouter » touché.
      </p>
    </div>
  );
}
