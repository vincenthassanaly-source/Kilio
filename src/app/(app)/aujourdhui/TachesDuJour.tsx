"use client";

import { useEffect, useRef, useState } from "react";
import type { TacheAvecRelations } from "@/app/actions/taches";
import { card } from "@/lib/ui";
import type { Plage } from "@/lib/programme/disponibilites";
import { DashboardTaskItem } from "../DashboardTaskItem";
import { AjoutRapideTache } from "./AjoutRapideTache";
import { PlanifierPanneau } from "./PlanifierPanneau";

// Pastille « Planifier » : 36 px visibles, zone de tap étendue à 44 px.
const pastillePlanifier =
  "relative min-h-9 shrink-0 rounded-full border border-line bg-surface-alt px-3 text-[12.5px] font-semibold text-ink transition-colors hover:border-kcal/60 active:scale-[0.97] after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

function Ligne({
  tache,
  surlignee,
  today,
  libres,
  planificationOuverte,
  onTogglePlanification,
}: {
  tache: TacheAvecRelations;
  surlignee: boolean;
  today: string;
  libres: Plage[];
  planificationOuverte: boolean;
  onTogglePlanification: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);

  // Tap sur un bloc de la frise : la ligne correspondante est mise en vue.
  useEffect(() => {
    if (surlignee) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
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
          />
        </div>
        {planifiable && (
          <button
            type="button"
            aria-expanded={planificationOuverte}
            aria-label={`Planifier « ${tache.titre} »`}
            onClick={onTogglePlanification}
            className={pastillePlanifier}
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
  onTacheCreee,
}: {
  // Toutes les tâches du jour (faites ou non), déjà triées.
  taches: TacheAvecRelations[];
  today: string;
  // Trous libres du jour, pour « Planifier ».
  libres: Plage[];
  tacheSurlignee: string | null;
  // Une tâche vient d'être ajoutée via le champ rapide : l'appelant la surligne.
  onTacheCreee: (id: string) => void;
}) {
  // Un seul panneau de planification ouvert à la fois.
  const [planificationId, setPlanificationId] = useState<string | null>(null);
  const aFaire = taches.filter((t) => !t.fait);
  const faites = taches.filter((t) => t.fait);

  return (
    <section aria-labelledby="aujourdhui-taches" className={`${card} flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="aujourdhui-taches" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Tâches
        </h2>
        {taches.length > 0 && (
          <span className="text-[12.5px] font-medium tabular-nums text-ink-2">
            {faites.length}/{taches.length} faites
          </span>
        )}
      </div>

      <AjoutRapideTache today={today} onCreated={onTacheCreee} />

      {taches.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">Rien de prévu aujourd&apos;hui.</p>
      ) : aFaire.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">Tout est fait pour aujourd&apos;hui.</p>
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
            />
          ))}
        </ul>
      )}

      {faites.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal">
            Faites ({faites.length})
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
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
