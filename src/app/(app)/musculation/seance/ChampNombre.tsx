"use client";

import { useState } from "react";
import { lireNombre } from "@/lib/musculation/seance";

const champSaisie =
  "h-12 w-full min-w-0 rounded-xl border border-transparent bg-surface-alt px-1 text-center text-base font-semibold tabular-nums text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-kcal/60 focus-visible:ring-2 focus-visible:ring-kcal";

/**
 * Champ numérique qui garde le texte tapé (« 82, » en cours de saisie) tout en
 * restant synchronisé avec la valeur de la série quand elle change ailleurs.
 * `signe` : accepte un moins (poids du corps assisté) — clavier texte, car le
 * pavé décimal d'iOS n'a pas de signe moins.
 */
export function ChampNombre({
  valeur,
  entier,
  signe,
  libelle,
  onChange,
}: {
  valeur: number | null;
  entier: boolean;
  signe: boolean;
  libelle: string;
  onChange: (valeur: number | null) => void;
}) {
  const [texte, setTexte] = useState(valeur === null ? "" : String(valeur).replace(".", ","));
  const [valeurVue, setValeurVue] = useState(valeur);
  if (valeur !== valeurVue) {
    setValeurVue(valeur);
    if (valeur !== lireNombre(texte, signe)) setTexte(valeur === null ? "" : String(valeur).replace(".", ","));
  }

  const motif = signe ? /^-?\d*[.,]?\d*$/ : /^\d*[.,]?\d*$/;
  return (
    <input
      type="text"
      inputMode={signe ? "text" : entier ? "numeric" : "decimal"}
      autoComplete="off"
      aria-label={libelle}
      placeholder="–"
      value={texte}
      onChange={(e) => {
        const brut = e.target.value;
        if (!motif.test(brut)) return;
        setTexte(brut);
        const nombre = lireNombre(brut, signe);
        onChange(nombre === null ? null : entier ? Math.trunc(nombre) : Math.round(nombre * 100) / 100);
      }}
      onFocus={(e) => e.currentTarget.select()}
      className={champSaisie}
    />
  );
}
