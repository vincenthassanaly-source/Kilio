import type { ReactNode } from "react";

/** Pastille d'icône d'une ligne de réglage (teinte du module à 12 %). */
export function Pastille({ children, teinte = "var(--accent-kcal)" }: { children: ReactNode; teinte?: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
      style={{ background: `color-mix(in oklch, ${teinte} 12%, transparent)` }}
    >
      {children}
    </span>
  );
}

/** En-tête d'une ligne : pastille + titre à gauche, contrôle (interrupteur, bouton) à droite. */
export function ReglageEntete({ icone, titre, action }: { icone: ReactNode; titre: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2.5">
        {icone}
        <span className="min-w-0 text-label font-medium text-ink">{titre}</span>
      </span>
      {action}
    </div>
  );
}

/**
 * Détail d'une ligne (explication, heure, erreur) : aligné sous le titre
 * (pastille 32 px + écart 10 px) pour qu'on lise qu'il en dépend.
 */
export function ReglageDetail({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5 pl-[42px]">{children}</div>;
}
