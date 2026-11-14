import type { ReactNode } from "react";
import { card, checkCircle } from "@/lib/ui";

/** Ligne de choix unique d'une liste (collection, destination…) : carte de 44 px
 * minimum avec cercle de sélection à droite, `aria-pressed` pour les lecteurs
 * d'écran. Le contenu (nom, pastille « Suggérée »…) est donné par l'appelant. */
export function LigneChoix({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`${card} flex min-h-11 w-full items-center justify-between gap-3 text-left transition-colors ${
        selected ? "border-kcal bg-kcal-soft" : "bg-surface"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">{children}</span>
      <span
        className={`${checkCircle} ${
          selected ? "border-kcal bg-kcal text-on-kcal" : "border-control-border bg-transparent"
        }`}
      >
        {selected && (
          <svg width={11} height={11} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 6l3.2 3.2L11 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
