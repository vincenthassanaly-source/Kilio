"use client";

import { varCouleurTheme } from "@/lib/opinions/couleurs";
import type { FiltreSuivi } from "@/lib/opinions/partis";
import { LIBELLE_THEME, type Theme } from "@/lib/opinions/types";
import { ghostButton } from "@/lib/ui";

export type StatTheme = { theme: Theme; lues: number; total: number };

/** Sous le bouton du thème fixe (ThemeToggle) posé en haut à droite par le layout. */
export const DECALAGE_BARRE = "calc(env(safe-area-inset-top) + 60px)";
/** Marge de défilement : la barre collante (≈ 8 rem) ne doit pas cacher la cible. */
export const MARGE_DEFILEMENT = "scroll-mt-[calc(env(safe-area-inset-top)+10.5rem)]";

const chip =
  "inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold tabular-nums transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/**
 * Barre collante d'un programme : progression « lues / total », saut vers la
 * prochaine proposition non lue, filtres cumulables (non lues, favoris) et
 * saut par thème. Une seule rangée défile à l'horizontale (pas de scroll de page).
 */
export function BarreSuiviLecture({
  lues,
  total,
  filtre,
  onFiltre,
  themes,
  onTheme,
  onProchaine,
}: {
  lues: number;
  total: number;
  filtre: FiltreSuivi;
  onFiltre: (filtre: FiltreSuivi) => void;
  themes: readonly StatTheme[];
  onTheme: (theme: Theme) => void;
  onProchaine: () => void;
}) {
  const ratio = total === 0 ? 0 : lues / total;
  const toutLu = total > 0 && lues === total;

  return (
    <div
      className="sticky z-30 -mx-4 flex flex-col gap-1 border-b border-line bg-surface px-4 pb-2 pt-2"
      style={{ top: DECALAGE_BARRE }}
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-[13px] font-semibold text-ink tabular-nums" aria-live="polite">
            {lues}/{total} lues
          </p>
          <div
            role="progressbar"
            aria-label="Progression de lecture"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={lues}
            className="h-1.5 overflow-hidden rounded-full bg-surface-alt"
          >
            <div
              className="h-full origin-left rounded-full bg-kcal transition-transform duration-300 motion-reduce:transition-none"
              style={{ transform: `scaleX(${ratio})` }}
            />
          </div>
        </div>
        <button type="button" className={`${ghostButton} shrink-0`} disabled={toutLu} onClick={onProchaine}>
          {toutLu ? "Tout est lu" : "Prochaine non lue"}
        </button>
      </div>

      <div
        className="-mx-4 flex snap-x items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Filtres et thèmes"
      >
        <button
          type="button"
          aria-pressed={filtre.nonLues}
          onClick={() => onFiltre({ ...filtre, nonLues: !filtre.nonLues })}
          className={`${chip} ${filtre.nonLues ? "border-kcal bg-kcal text-on-kcal" : "border-line bg-surface text-ink"}`}
        >
          Non lues
        </button>
        <button
          type="button"
          aria-pressed={filtre.favoris}
          onClick={() => onFiltre({ ...filtre, favoris: !filtre.favoris })}
          className={`${chip} ${filtre.favoris ? "border-kcal bg-kcal text-on-kcal" : "border-line bg-surface text-ink"}`}
        >
          {filtre.favoris ? "★" : "☆"} Favoris
        </button>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-line" />
        {themes.map(({ theme, lues: l, total: t }) => (
          <button
            key={theme}
            type="button"
            onClick={() => onTheme(theme)}
            aria-label={`${LIBELLE_THEME[theme]}, ${l} lues sur ${t}. Aller à ce thème`}
            className={`${chip} border-line bg-surface text-ink`}
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: varCouleurTheme(theme) }} />
            {LIBELLE_THEME[theme]}
            <span className="text-ink-2">
              {l}/{t}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
