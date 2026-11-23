"use client";

import { useState } from "react";
import type { TacheAvecRelations } from "@/app/actions/taches";
import type { CibleReport } from "@/lib/taches/compute";
import { libelleRetard } from "@/lib/aujourdhui/compute";
import { DashboardTaskItem } from "../DashboardTaskItem";
import { LIBELLES_REPORT, useReporterTaches } from "../taches/useReporterTaches";
import { card, sectionTitle } from "@/lib/ui";
import { badgeEnRetard } from "@/lib/taches/badges";
import { pastilleAction } from "./pastilles";

// Au-delà, le reste se déplie : une liste de retard qui s'allonge ne doit pas
// repousser la journée hors de l'écran.
const NB_VISIBLES = 3;

const CIBLES = Object.keys(LIBELLES_REPORT) as CibleReport[];


// Flèche « reporter » (dessinée, trait de 1.8 comme les icônes de la barre du bas).
const REPORT_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12h13" />
    <path d="m12 6 6 6-6 6" />
  </svg>
);

function LigneRetard({
  tache,
  today,
  compact,
  onOuvrir,
}: {
  tache: TacheAvecRelations;
  today: string;
  compact: boolean;
  onOuvrir?: (tache: TacheAvecRelations) => void;
}) {
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
            onOuvrir={onOuvrir ? () => onOuvrir(tache) : undefined}
          />
        </div>
        {compact && (
          <button
            type="button"
            aria-expanded={ouvert}
            aria-controls={idPuces}
            aria-label={`Choisir une date de report pour « ${tache.titre} »`}
            onClick={() => setOuvert((v) => !v)}
            className={pastilleAction}
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
          <span aria-hidden className="mr-0.5 text-ink-3">
            {REPORT_ICON}
          </span>
          {CIBLES.map((cible) => (
            <button
              key={cible}
              type="button"
              disabled={enCours}
              onClick={() => handleReport(cible)}
              className={pastilleAction}
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
  masquerTitre = false,
  onOuvrir,
}: {
  taches: TacheAvecRelations[];
  today: string;
  /** Une ligne par tâche, puces de report à la demande (écran Aujourd'hui). La Revue garde les puces visibles. */
  compact?: boolean;
  /** Masque le titre « En retard » et sa pastille de nombre, quand un titre d'étape les porte déjà (Revue). */
  masquerTitre?: boolean;
  /** Toucher le titre d'une tâche l'ouvre (écran Aujourd'hui). */
  onOuvrir?: (tache: TacheAvecRelations) => void;
}) {
  const [deplie, setDeplie] = useState(false);
  if (taches.length === 0) return null;

  const visibles = deplie ? taches : taches.slice(0, NB_VISIBLES);
  const cachees = taches.length - visibles.length;

  return (
    <section
      {...(masquerTitre ? { "aria-label": "Tâches en retard" } : { "aria-labelledby": "aujourdhui-retard" })}
      className={`${card} flex flex-col gap-3`}
    >
      {!masquerTitre && (
        <div className="flex items-center justify-between gap-2">
          <h2 id="aujourdhui-retard" className={sectionTitle}>
            En retard
          </h2>
          <span className={badgeEnRetard}>
            {taches.length}
            <span className="sr-only"> en retard</span>
          </span>
        </div>
      )}
      {!compact && <p className={`${masquerTitre ? "" : "-mt-1.5 "}text-small text-ink-2`}>Reporte d&apos;un tap : aujourd&apos;hui, demain ou lundi.</p>}
      <ul className="flex flex-col gap-3.5">
        {visibles.map((tache) => (
          <LigneRetard key={tache.id} tache={tache} today={today} compact={compact} onOuvrir={onOuvrir} />
        ))}
      </ul>
      {taches.length > NB_VISIBLES && (
        <button
          type="button"
          aria-expanded={deplie}
          onClick={() => setDeplie((v) => !v)}
          className="relative -mb-1 self-start text-small font-semibold text-kcal after:absolute after:-inset-x-2 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        >
          {deplie ? "Réduire" : `Afficher ${cachees === 1 ? "l'autre" : `les ${cachees} autres`}`}
        </button>
      )}
    </section>
  );
}
