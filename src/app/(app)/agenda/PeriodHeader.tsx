"use client";

import { navArrowButton, sectionTitle } from "@/lib/ui";

// En-tête de période partagé par les vues Jour/Semaine/Mois : navigation
// ←/→ (cibles tactiles ≥44×44px, cf. navArrowButton) et titre de la période
// affichée. Le lien "Aujourd'hui" n'apparaît que lorsque la période
// affichée ne contient pas la date du jour, mais réserve toujours sa place
// (rendu invisible plutôt qu'absent du DOM) pour que la hauteur de
// l'en-tête ne saute jamais entre les deux états.
export function PeriodHeader({
  title,
  capitalizeTitle = false,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  showToday,
  onToday,
}: {
  title: string;
  capitalizeTitle?: boolean;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  showToday: boolean;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={onPrev} className={navArrowButton} aria-label={prevLabel}>
        ←
      </button>
      <div className="flex flex-col items-center gap-0.5">
        <span className={`${sectionTitle} ${capitalizeTitle ? "capitalize" : ""}`}>{title}</span>
        {showToday ? (
          <button
            type="button"
            onClick={onToday}
            className="text-caption font-semibold text-kcal underline"
          >
            Aujourd&apos;hui
          </button>
        ) : (
          <span aria-hidden className="invisible text-xs font-semibold">
            Aujourd&apos;hui
          </span>
        )}
      </div>
      <button type="button" onClick={onNext} className={navArrowButton} aria-label={nextLabel}>
        →
      </button>
    </div>
  );
}
