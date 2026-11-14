"use client";

import { navArrowButton } from "@/lib/ui";
import { ChevronIcon } from "@/components/icons";

// La date affichée est le vrai contenu de l'écran : elle passe devant le
// titre « Agenda » (28 px) plutôt que d'être reléguée à 15 px.
const TITRE_PERIODE = "font-display text-heading leading-tight font-semibold tracking-[-0.02em] text-ink text-balance text-center";

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
        <ChevronIcon sens="gauche" size={18} />
      </button>
      <div className="flex flex-col items-center gap-0.5">
        <span className={`${TITRE_PERIODE} ${capitalizeTitle ? "capitalize" : ""}`}>{title}</span>
        {showToday ? (
          <button
            type="button"
            onClick={onToday}
            className="relative text-caption font-semibold text-kcal underline after:absolute after:-inset-x-3 after:-inset-y-3.5"
          >
            Aujourd&apos;hui
          </button>
        ) : (
          <span aria-hidden className="invisible text-caption font-semibold">
            Aujourd&apos;hui
          </span>
        )}
      </div>
      <button type="button" onClick={onNext} className={navArrowButton} aria-label={nextLabel}>
        <ChevronIcon sens="droite" size={18} />
      </button>
    </div>
  );
}
