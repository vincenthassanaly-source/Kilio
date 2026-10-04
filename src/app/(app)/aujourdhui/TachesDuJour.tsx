"use client";

import { useEffect, useRef } from "react";
import type { TacheAvecRelations } from "@/app/actions/taches";
import { card } from "@/lib/ui";
import { DashboardTaskItem } from "../DashboardTaskItem";

function Ligne({ tache, surlignee }: { tache: TacheAvecRelations; surlignee: boolean }) {
  const ref = useRef<HTMLLIElement>(null);

  // Tap sur un bloc de la frise : la ligne correspondante est mise en vue.
  useEffect(() => {
    if (surlignee) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [surlignee]);

  return (
    <li ref={ref} className={`rounded-xl transition-colors ${surlignee ? "tache-surbrillance" : ""}`}>
      <DashboardTaskItem
        id={tache.id}
        titre={tache.titre}
        heure={tache.heure}
        fait={tache.fait}
        echeance={tache.echeance}
      />
    </li>
  );
}

/**
 * Tâches du jour, avec heure d'abord. Les tâches faites restent atteignables
 * (repliées) pour pouvoir décocher une erreur sans quitter l'écran.
 */
export function TachesDuJour({
  taches,
  tacheSurlignee,
}: {
  // Toutes les tâches du jour (faites ou non), déjà triées.
  taches: TacheAvecRelations[];
  tacheSurlignee: string | null;
}) {
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

      {taches.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">Rien de prévu aujourd&apos;hui.</p>
      ) : aFaire.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">Tout est fait pour aujourd&apos;hui.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {aFaire.map((t) => (
            <Ligne key={t.id} tache={t} surlignee={t.id === tacheSurlignee} />
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
              <Ligne key={t.id} tache={t} surlignee={t.id === tacheSurlignee} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
