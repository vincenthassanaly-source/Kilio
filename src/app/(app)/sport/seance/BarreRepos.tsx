"use client";

import { formaterMinutes, type Repos } from "@/lib/sport/seance";

const bouton =
  "flex h-11 min-w-[56px] items-center justify-center rounded-xl border border-line bg-surface px-3 text-[13.5px] font-semibold text-ink tabular-nums transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/**
 * Minuteur de repos collé en bas de l'écran de séance. Il reste affiché une
 * fois le temps écoulé (« Repos terminé ») jusqu'à la prochaine série
 * validée ou jusqu'à ce qu'on le ferme : on peut poser le téléphone sans
 * rater la fin.
 */
export function BarreRepos({
  repos,
  restant,
  onAjuster,
  onFermer,
}: {
  repos: Repos | null;
  restant: number;
  onAjuster: (deltaS: number) => void;
  onFermer: () => void;
}) {
  if (!repos) return null;
  const fini = restant <= 0;
  const progression = fini ? 100 : Math.max(0, Math.min(100, ((repos.dureeS - restant) / repos.dureeS) * 100));

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-[22px] border border-line bg-nav p-3.5 shadow-card backdrop-blur-xl">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
          <div
            className="h-full rounded-full bg-kcal transition-[width] duration-300 ease-linear motion-reduce:transition-none"
            style={{ width: `${progression}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[12.5px] font-medium text-ink-2">{fini ? "Repos terminé" : "Repos"}</span>
            <span
              className={`font-display text-[30px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${
                fini ? "text-kcal" : "text-ink"
              }`}
              role="timer"
              aria-live="off"
            >
              {fini ? "C'est reparti" : formaterMinutes(restant)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!fini && (
              <>
                <button type="button" className={bouton} onClick={() => onAjuster(-15)} aria-label="Retirer 15 secondes">
                  −15 s
                </button>
                <button type="button" className={bouton} onClick={() => onAjuster(15)} aria-label="Ajouter 15 secondes">
                  +15 s
                </button>
              </>
            )}
            <button
              type="button"
              className={`${bouton} ${fini ? "border-transparent bg-kcal text-on-kcal" : ""}`}
              onClick={onFermer}
            >
              {fini ? "OK" : "Passer"}
            </button>
          </div>
        </div>
        {fini && (
          <span role="status" className="sr-only">
            Repos terminé, prochaine série
          </span>
        )}
      </div>
    </div>
  );
}
