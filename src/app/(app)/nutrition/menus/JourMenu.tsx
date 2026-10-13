"use client";

import { useEffect, useRef } from "react";
import { MOMENT_LABELS, type MomentRepas, type Nutrition } from "@/lib/nutrition/compute";
import { card } from "@/lib/ui";
import { AjoutMenuBouton } from "./AjoutMenuBouton";
import { BasculeEntrainementJour } from "./BasculeEntrainementJour";
import { ComparaisonObjectif } from "./ComparaisonObjectif";
import { LigneMenu, type RepasPlanifie } from "./LigneMenu";

export type CreneauMenu = { moment: MomentRepas; repas: RepasPlanifie[] };

/**
 * Carte d'un jour : en-tête (jour, bascule entraînement), menu prévu comparé à
 * la cible, puis les 4 créneaux, le « + » de chacun à portée du pouce. Le jour
 * courant est repéré par son contour et une pastille « Aujourd'hui » ; si la
 * semaine affichée est la semaine courante, la page s'ouvre sur lui.
 */
export function JourMenu({
  date,
  jourLabel,
  jourCourt,
  estAujourdhui,
  defiler,
  entraine,
  libre,
  prevu,
  cible,
  creneaux,
}: {
  date: string;
  jourLabel: string;
  jourCourt: string;
  estAujourdhui: boolean;
  /** Fait défiler jusqu'à cette carte à l'ouverture (jour courant, hors lundi). */
  defiler: boolean;
  /** Jour d'entraînement (sinon repos) : choisit la cible de comparaison. */
  entraine: boolean;
  /** Jour libre : la limite kcal est suspendue, pas de comparaison. */
  libre: boolean;
  prevu: Nutrition;
  /** Cible du type de jour, ou null si aucun objectif n'est défini pour ce type. */
  cible: Nutrition | null;
  creneaux: CreneauMenu[];
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (defiler) ref.current?.scrollIntoView({ block: "start" });
  }, [defiler]);

  return (
    <section
      ref={ref}
      aria-labelledby={`menu-${date}`}
      className={`${card} scroll-mt-4 flex flex-col gap-1 ${estAujourdhui ? "border-kcal/60" : ""}`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={`menu-${date}`} className="font-display text-[17px] font-semibold capitalize text-ink">
            {jourCourt}
          </h2>
          {estAujourdhui && (
            <span className="shrink-0 rounded-full bg-kcal-soft px-2.5 py-1 text-[11px] font-bold text-kcal">
              Aujourd&apos;hui
            </span>
          )}
        </div>
        <BasculeEntrainementJour date={date} jourLabel={jourLabel} entraine={entraine} />
      </header>

      <div className="pb-1">
        <ComparaisonObjectif prevu={prevu} cible={cible} libre={libre} />
      </div>

      {creneaux.map(({ moment, repas }) => (
        <div key={moment} className="border-t border-line pt-1">
          <div className="flex min-h-11 items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{MOMENT_LABELS[moment]}</h3>
            <AjoutMenuBouton date={date} moment={moment} jourLabel={jourLabel} />
          </div>
          {repas.length > 0 && (
            <ul className="flex flex-col pb-1">
              {repas.map((r) => (
                <LigneMenu key={r.id} repas={r} />
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
