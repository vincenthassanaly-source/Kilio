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
  "relative min-h-9 rounded-full border border-line bg-surface-alt px-3 text-small font-semibold text-ink after:absolute after:-inset-y-1 after:inset-x-0 transition-colors hover:border-kcal/60 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

// Flèche « reporter » (dessinée, trait de 1.8 comme les icônes de la barre du bas).
const REPORT_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12h13" />
    <path d="m12 6 6 6-6 6" />
  </svg>
);

function LigneRetard({ tache, today, compact }: { tache: TacheAvecRelations; today: string; compact: boolean }) {
  const reporter = useReporterTaches();
  const [enCours, setEnCours] = useState(false);
  // En mode compact, les trois puces ne s'affichent qu'à la demande : une ligne
  // par tâche au repos au lieu de quatre.
  const [ouvert, setOuvert] = useState(false);
  const idPuces = `reporter-${tache.id}`;

  async function handleReport(cible: CibleReport) {
    setEnCours(true);
    try {
      await reporter([tache], cible);
    } finally {
      setEnCours(false);
    }
  }

  const pastillesVisibles = !compact || ouvert;

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <DashboardTaskItem
            id={tache.id}
            titre={tache.titre}
            heure={tache.heure}
            fait={tache.fait}
            echeance={tache.echeance}
            detail={libelleRetard(tache.echeance!, today)}
          />
        </div>
        {compact && (
          <button
            type="button"
            aria-expanded={ouvert}
            aria-controls={idPuces}
            aria-label={`Reporter « ${tache.titre} »`}
            onClick={() => setOuvert((v) => !v)}
            className="relative shrink-0 text-small font-semibold text-kcal after:absolute after:-inset-x-2 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
          >
            Reporter
          </button>
        )}
      </div>
      {pastillesVisibles && (
        <div
          id={idPuces}
          className="flex flex-wrap items-center gap-1.5 pl-[34px]"
          role="group"
          aria-label={`Reporter « ${tache.titre} »`}
        >
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
      )}
    </li>
  );
}

export function EnRetardSection({
  taches,
  today,
  compact = false,
}: {
  taches: TacheAvecRelations[];
  today: string;
  /** Une ligne par tâche, puces de report à la demande (écran Aujourd'hui). La Revue garde les puces visibles. */
  compact?: boolean;
}) {
  const [deplie, setDeplie] = useState(false);
  if (taches.length === 0) return null;

  const visibles = deplie ? taches : taches.slice(0, NB_VISIBLES);
  const cachees = taches.length - visibles.length;

  return (
    <section
      aria-labelledby="aujourdhui-retard"
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="aujourdhui-retard" className="text-body font-semibold tracking-[-0.01em] text-ink">
          En retard
        </h2>
        <span className="rounded-full bg-alert/10 px-2.5 py-1 text-micro font-bold tabular-nums text-alert">
          {taches.length}
        </span>
      </div>
      {!compact && <p className="-mt-1.5 text-small text-ink-2">Reporte d&apos;un tap : aujourd&apos;hui, demain ou lundi.</p>}
      <ul className="flex flex-col gap-3.5">
        {visibles.map((tache) => (
          <LigneRetard key={tache.id} tache={tache} today={today} compact={compact} />
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
