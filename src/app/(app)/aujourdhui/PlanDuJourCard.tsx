"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { planifierTache, restaurerPlanification, type TacheAvecRelations } from "@/app/actions/taches";
import { showActionToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { libelleRetard } from "@/lib/aujourdhui/compute";
import { construirePlanDuJour, type Proposition } from "@/lib/aujourdhui/plan";
import { queryKeys } from "@/lib/query/keys";
import type { Plage } from "@/lib/programme/disponibilites";
import { libelleDuree } from "@/lib/taches/compute";
import { card, ghostButton, primaryButton, sectionTitle } from "@/lib/ui";

/**
 * « Plan du jour » : propose de ranger les tâches en retard et celles du jour
 * (sans heure) dans les trous libres de la frise — priorité d'abord. Rien n'est
 * planifié sans un tap : « Placer » pour une tâche, « Tout placer » pour le
 * plan entier, avec un « Annuler » qui rétablit l'état d'avant.
 */
export function PlanDuJourCard({
  taches,
  libres,
  today,
}: {
  taches: TacheAvecRelations[];
  libres: Plage[];
  today: string;
}) {
  const queryClient = useQueryClient();
  const [enCours, setEnCours] = useState(false);
  const [masque, setMasque] = useState(false);

  const plan = useMemo(() => construirePlanDuJour(taches, libres, today), [taches, libres, today]);

  if (masque || (plan.propositions.length === 0 && plan.nonPlacees.length === 0)) return null;

  async function placer(propositions: Proposition<TacheAvecRelations>[]) {
    if (enCours || propositions.length === 0) return;
    setEnCours(true);
    const annulables: { id: string; avant: Parameters<typeof restaurerPlanification>[1] }[] = [];
    for (const { tache, creneau, dureeMinutes } of propositions) {
      const avant = {
        echeance: tache.echeance,
        heure: tache.heure,
        heure_fin: tache.heure_fin,
        toute_la_journee: tache.toute_la_journee,
        duree_minutes: tache.duree_minutes ?? null,
      };
      const resultat = await runAction(() =>
        planifierTache(tache.id, today, creneau.debut, dureeMinutes, tache.duree_minutes == null)
      );
      if (!resultat.ok) break;
      annulables.push({ id: tache.id, avant });
    }
    setEnCours(false);
    if (annulables.length === 0) return;

    await queryClient.invalidateQueries({ queryKey: queryKeys.taches });
    const texte = annulables.length === 1 ? "1 tâche planifiée" : `${annulables.length} tâches planifiées`;
    showActionToast(texte, {
      ariaLabel: `Annuler : ${texte}`,
      onAction: () => {
        void Promise.all(
          annulables.map((a) => runAction(() => restaurerPlanification(a.id, a.avant), { erreur: "Impossible d'annuler. Réessaie." }))
        ).then(() => queryClient.invalidateQueries({ queryKey: queryKeys.taches }));
      },
    });
  }

  const surcharge = plan.minutesDemandees > plan.minutesLibres;

  return (
    <section aria-labelledby="plan-du-jour" className={`${card} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="plan-du-jour" className={sectionTitle}>
            Plan du jour
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            {libelleDuree(plan.minutesDemandees)} estimées · {libelleDuree(plan.minutesLibres)} libres
            {surcharge ? " — trop pour aujourd'hui" : ""}
          </p>
        </div>
        <button type="button" onClick={() => setMasque(true)} className={`${ghostButton} shrink-0`}>
          Masquer
        </button>
      </div>

      {plan.propositions.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {plan.propositions.map((p) => {
            const retard = p.tache.echeance! < today;
            return (
              <li key={p.tache.id} className="flex items-center gap-3 rounded-xl bg-surface-alt px-3 py-2">
                {/* Titre sur toute la largeur (2 lignes max) ; l'horaire passe en méta, en gras. */}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[14px] text-ink">{p.tache.titre}</span>
                  <span className="block text-[12.5px] tabular-nums text-ink-2">
                    <span className="font-semibold text-ink">
                      {p.creneau.debut} – {p.creneau.fin}
                    </span>
                    {` · ${libelleDuree(p.dureeMinutes)}`}
                    {p.tache.priorite === "haute" ? " · priorité haute" : ""}
                    {retard ? ` · en retard (${libelleRetard(p.tache.echeance!, today)})` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => placer([p])}
                  aria-label={`Placer « ${p.tache.titre} » de ${p.creneau.debut} à ${p.creneau.fin}`}
                  className={`${ghostButton} shrink-0`}
                >
                  Placer
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-2">Aucun trou libre aujourd&apos;hui pour tes tâches. Reporte-en ou raccourcis-les.</p>
      )}

      {plan.nonPlacees.length > 0 && plan.propositions.length > 0 && (
        <p className="text-[12.5px] text-ink-2">
          {plan.nonPlacees.length === 1
            ? "1 tâche ne tient pas aujourd'hui"
            : `${plan.nonPlacees.length} tâches ne tiennent pas aujourd'hui`}{" "}
          — pense à les reporter.
        </p>
      )}

      {plan.propositions.length > 1 && (
        <button type="button" disabled={enCours} onClick={() => placer(plan.propositions)} className={primaryButton}>
          {enCours ? "Planification…" : "Tout placer"}
        </button>
      )}
    </section>
  );
}
