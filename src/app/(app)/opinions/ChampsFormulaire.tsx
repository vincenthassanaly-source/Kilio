"use client";

import { useId, type ReactNode } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SCORE_MAX, SCORE_MIN, formaterScore, libelleScore, type Axe } from "@/lib/opinions/types";
import { label } from "@/lib/ui";

/** Champ de formulaire : libellé visible relié à son contrôle, aide facultative. */
export function Champ({
  libelle,
  children,
  aide,
}: {
  libelle: string;
  children: (id: string) => ReactNode;
  aide?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={label}>
        {libelle}
      </label>
      {children(id)}
      {aide && <div className="text-xs text-ink-3">{aide}</div>}
    </div>
  );
}

// « Non concerné » (null) est distinct de « Neutre » (0) : l'axe est ignoré du
// profil dans le premier cas, compté comme une position centrale dans le second.
const SANS_SCORE = "aucun";
const VALEURS_SCORE = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);

/** Position sur un axe : « — », puis -2 à +2, avec le sens en toutes lettres. */
export function LigneScore({
  axe,
  score,
  onChange,
}: {
  axe: Axe;
  score: number | null;
  onChange: (score: number | null) => void;
}) {
  const options = [
    { value: SANS_SCORE, label: "—", ariaLabel: "Non concerné" },
    ...VALEURS_SCORE.map((valeur) => ({
      value: String(valeur),
      label: formaterScore(valeur),
      ariaLabel: libelleScore(axe, valeur),
    })),
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={label}>{axe.label}</span>
        <span className="text-xs text-ink-2" aria-live="polite">
          {libelleScore(axe, score)}
        </span>
      </div>
      <SegmentedControl
        options={options}
        value={score === null ? SANS_SCORE : String(score)}
        onChange={(valeur) => onChange(valeur === SANS_SCORE ? null : Number(valeur))}
        ariaLabel={`Position sur l'axe ${axe.label}`}
        taille="sm"
      />
      <div className="flex justify-between text-xs text-ink-3" aria-hidden="true">
        <span>‹ {axe.gauche}</span>
        <span>{axe.droite} ›</span>
      </div>
    </div>
  );
}
