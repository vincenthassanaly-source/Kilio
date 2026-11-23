"use client";

import { useEffect, useRef, useState } from "react";
import type { TacheAvecRelations } from "@/app/actions/taches";
import { card, sectionTitle } from "@/lib/ui";
import type { Plage } from "@/lib/programme/disponibilites";
import { DashboardTaskItem } from "../DashboardTaskItem";
import { PlanifierPanneau } from "./PlanifierPanneau";
import { pastilleAction } from "./pastilles";

function Ligne({
  tache,
  surlignee,
  today,
  libres,
  planificationOuverte,
  onTogglePlanification,
  onOuvrir,
}: {
  tache: TacheAvecRelations;
  surlignee: boolean;
  today: string;
  libres: Plage[];
  planificationOuverte: boolean;
  onTogglePlanification: () => void;
  onOuvrir?: (tache: TacheAvecRelations) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);

  // Tap sur un bloc de la frise : la ligne correspondante est mise en vue.
  useEffect(() => {
    if (surlignee) ref.current?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
  }, [surlignee]);

  // Planifiable : une tâche à faire, sans heure (une tâche déjà horodatée a sa
  // place dans la frise).
  const planifiable = !tache.fait && !tache.heure;

  return (
    <li ref={ref} className={`rounded-xl transition-colors ${surlignee ? "tache-surbrillance" : ""}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <DashboardTaskItem
            id={tache.id}
            titre={tache.titre}
            heure={tache.heure}
            fait={tache.fait}
            echeance={tache.echeance}
            onOuvrir={onOuvrir ? () => onOuvrir(tache) : undefined}
          />
        </div>
        {planifiable && (
          <button
            type="button"
            aria-expanded={planificationOuverte}
            aria-label={`Planifier « ${tache.titre} »`}
            onClick={onTogglePlanification}
            className={pastilleAction}
          >
            Planifier
          </button>
        )}
      </div>
      {planifiable && planificationOuverte && (
        <PlanifierPanneau tache={tache} today={today} libres={libres} onClose={onTogglePlanification} />
      )}
    </li>
  );
}

/**
 * Tâches du jour, avec heure d'abord. Les tâches faites restent atteignables
 * (repliées) pour pouvoir décocher une erreur sans quitter l'écran.
 */
export function TachesDuJour({
  taches,
  today,
  libres,
  tacheSurlignee,
  onOuvrir,
}: {
  // Toutes les tâches du jour (faites ou non), déjà triées.
  taches: TacheAvecRelations[];
  today: string;
  // Trous libres du jour, pour « Planifier ».
  libres: Plage[];
  tacheSurlignee: string | null;
  // Toucher le titre d'une tâche l'ouvre (cocher reste sur la case).
  onOuvrir?: (tache: TacheAvecRelations) => void;
}) {
  // Un seul panneau de planification ouvert à la fois.
  const [planificationId, setPlanificationId] = useState<string | null>(null);
  const aFaire = taches.filter((t) => !t.fait);
  const faites = taches.filter((t) => t.fait);

  return (
    <section aria-labelledby="aujourdhui-taches" className={`${card} flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="aujourdhui-taches" className={sectionTitle}>
          Tâches
        </h2>
        {taches.length > 0 && (
          <span className="text-small font-medium tabular-nums text-ink-2">
            {faites.length}/{taches.length} terminées
          </span>
        )}
      </div>

      {taches.length === 0 ? (
        <p className="text-label text-ink-2">Rien de prévu aujourd&apos;hui.</p>
      ) : aFaire.length === 0 ? (
        <p className="text-label font-semibold text-kcal">Tout est fait pour aujourd&apos;hui.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {aFaire.map((t) => (
            <Ligne
              key={t.id}
              tache={t}
              surlignee={t.id === tacheSurlignee}
              today={today}
              libres={libres}
              planificationOuverte={planificationId === t.id}
              onTogglePlanification={() => setPlanificationId((id) => (id === t.id ? null : t.id))}
              onOuvrir={onOuvrir}
            />
          ))}
        </ul>
      )}

      {faites.length > 0 && (
        // Tout est coché : les tâches faites restent visibles, c'est la victoire du jour.
        <details className="group" open={aFaire.length === 0}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl text-small font-semibold text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            Tâches terminées ({faites.length})
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-3 transition-transform duration-150 ease-[var(--ease-out)] group-open:rotate-90">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </summary>
          <ul className="flex flex-col gap-2.5">
            {faites.map((t) => (
              <Ligne
                key={t.id}
                tache={t}
                surlignee={t.id === tacheSurlignee}
                today={today}
                libres={libres}
                planificationOuverte={false}
                onTogglePlanification={() => {}}
                onOuvrir={onOuvrir}
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
