"use client";

import { useState } from "react";
import type { TacheAvecRelations } from "@/app/actions/taches";
import type { CibleReport } from "@/lib/taches/compute";
import { libelleRetard } from "@/lib/aujourdhui/compute";
import { DashboardTaskItem } from "../DashboardTaskItem";
import { LIBELLES_REPORT, useReporterTaches } from "../taches/useReporterTaches";

// Au-delà, le reste se déplie : une liste de retard qui s'allonge ne doit pas
// repousser la journée hors de l'écran.
const NB_VISIBLES = 3;

const CIBLES = Object.keys(LIBELLES_REPORT) as CibleReport[];

// Pastille de report : 36 px visibles, zone de tap étendue à 44 px.
const pastilleReport =
  "relative min-h-9 rounded-full border border-line bg-surface-alt px-3 text-[12.5px] font-semibold text-ink after:absolute after:-inset-y-1 after:inset-x-0 transition-colors hover:border-kcal/60 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

// Flèche « reporter » (dessinée, trait de 1.8 comme les icônes de la barre du bas).
const REPORT_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12h13" />
    <path d="m12 6 6 6-6 6" />
  </svg>
);

function LigneRetard({ tache, today }: { tache: TacheAvecRelations; today: string }) {
  const reporter = useReporterTaches();
  const [enCours, setEnCours] = useState(false);

  async function handleReport(cible: CibleReport) {
    setEnCours(true);
    try {
      await reporter([tache], cible);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <li className="flex flex-col gap-2">
      <DashboardTaskItem
        id={tache.id}
        titre={tache.titre}
        heure={tache.heure}
        fait={tache.fait}
        echeance={tache.echeance}
        detail={libelleRetard(tache.echeance!, today)}
      />
      <div className="flex items-center gap-1.5 pl-[34px]" role="group" aria-label={`Reporter « ${tache.titre} »`}>
        <span className="mr-0.5 text-ink-3" title="Reporter à">
          {REPORT_ICON}
        </span>
        {CIBLES.map((cible) => (
          <button
            key={cible}
            type="button"
            disabled={enCours}
            onClick={() => handleReport(cible)}
            className={pastilleReport}
            aria-label={`Reporter « ${tache.titre} » à ${LIBELLES_REPORT[cible].toLowerCase()}`}
          >
            {LIBELLES_REPORT[cible]}
          </button>
        ))}
      </div>
    </li>
  );
}

export function EnRetardSection({ taches, today }: { taches: TacheAvecRelations[]; today: string }) {
  const [deplie, setDeplie] = useState(false);
  if (taches.length === 0) return null;

  const visibles = deplie ? taches : taches.slice(0, NB_VISIBLES);
  const cachees = taches.length - visibles.length;

  return (
    <section
      aria-labelledby="aujourdhui-retard"
      className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="aujourdhui-retard" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          En retard
        </h2>
        <span className="rounded-full bg-alert/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-alert">
          {taches.length}
        </span>
      </div>
      <p className="-mt-1.5 text-[12.5px] text-ink-2">Reporte d&apos;un tap : aujourd&apos;hui, demain ou lundi.</p>
      <ul className="flex flex-col gap-3.5">
        {visibles.map((tache) => (
          <LigneRetard key={tache.id} tache={tache} today={today} />
        ))}
      </ul>
      {taches.length > NB_VISIBLES && (
        <button
          type="button"
          aria-expanded={deplie}
          onClick={() => setDeplie((v) => !v)}
          className="relative -mb-1 self-start text-sm font-semibold text-kcal after:absolute after:-inset-x-2 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        >
          {deplie ? "Réduire" : `Afficher ${cachees === 1 ? "l'autre" : `les ${cachees} autres`}`}
        </button>
      )}
    </section>
  );
}
