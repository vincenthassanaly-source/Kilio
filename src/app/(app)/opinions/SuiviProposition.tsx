"use client";

import type { PropositionParti } from "@/lib/opinions/partis";

function Etoile({ pleine }: { pleine: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={pleine ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  );
}

/**
 * Suivi de lecture d'une proposition : case « Lu » (cochée à la main, jamais
 * automatique) et étoile « à relire / à garder ». Les deux sont indépendantes.
 * L'état se lit sans la couleur : case cochée, étoile pleine ou vide.
 */
export function SuiviProposition({
  proposition,
  onBasculer,
}: {
  proposition: Pick<PropositionParti, "lu" | "favori">;
  onBasculer: (champ: "lu" | "favori") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 pr-3 text-sm font-medium text-ink">
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={proposition.lu}
            onChange={() => onBasculer("lu")}
            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-ink-3 bg-surface-alt transition-colors checked:border-kcal checked:bg-kcal motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
          />
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute hidden text-on-kcal peer-checked:block"
          >
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
        Lu
      </label>
      <button
        type="button"
        aria-pressed={proposition.favori}
        aria-label={proposition.favori ? "Retirer des favoris" : "Mettre en favori"}
        onClick={() => onBasculer("favori")}
        className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-[0.94] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${
          proposition.favori ? "text-kcal" : "text-ink-3 hover:bg-surface-alt"
        }`}
      >
        <Etoile pleine={proposition.favori} />
      </button>
    </div>
  );
}
