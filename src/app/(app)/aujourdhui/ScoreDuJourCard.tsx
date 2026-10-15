"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getResumeNutritionJour } from "@/app/actions/journal";
import { getHabitudesDuJour } from "@/app/actions/habitudes";
import { getSemaineSeances } from "@/app/actions/seances";
import { ProgressRing } from "@/components/ProgressRing";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { scoreDuJour } from "@/lib/aujourdhui/score";
import { estFait } from "@/lib/habitudes/compute";
import { queryKeys } from "@/lib/query/keys";
import { card, sectionTitle } from "@/lib/ui";

/**
 * Score de la journée : un anneau et une ligne par domaine qui a un objet
 * aujourd'hui (tâches du jour, nutrition, sport, habitudes). Les données sont
 * celles que l'écran Aujourd'hui précharge déjà (mêmes clés TanStack Query) :
 * aucune requête de plus. Ton neutre, aucun retard : un domaine sans objet est
 * simplement absent, et la carte disparaît s'il n'y a rien à mesurer.
 */
export function ScoreDuJourCard({
  today,
  tachesDuJour,
  tachesChargent,
}: {
  today: string;
  tachesDuJour: readonly { fait: boolean }[];
  tachesChargent: boolean;
}) {
  const { data: resume, isLoading: nutritionCharge } = useQuery({
    queryKey: queryKeys.resumeNutrition(today),
    queryFn: () => getResumeNutritionJour(today),
  });
  const { data: seances, isLoading: seancesChargent } = useQuery({
    queryKey: queryKeys.seancesSemaine(today),
    queryFn: () => getSemaineSeances(today),
  });
  const { data: habitudes, isLoading: habitudesChargent } = useQuery({
    queryKey: queryKeys.habitudes(today),
    queryFn: () => getHabitudesDuJour(today),
  });

  const score = useMemo(
    () =>
      scoreDuJour({
        taches: tachesDuJour,
        nutrition: resume ? { kcal: resume.consomme.kcal, kcalGoal: resume.kcalGoal, jourLibre: resume.jourLibre } : null,
        sport: seances
          ? { entraineAujourdhui: resume?.jourType === "entrainement", seancesFaites: seances.seancesAujourdhui }
          : null,
        habitudes: habitudes
          ? habitudes.map((h) => ({ fait: estFait(h, h.entreeDuJour?.valeur), hebdo: h.frequence_hebdo != null }))
          : null,
      }),
    [tachesDuJour, resume, seances, habitudes]
  );

  if (tachesChargent || nutritionCharge || seancesChargent || habitudesChargent) {
    return <Skeleton className="h-[116px] w-full rounded-[22px]" />;
  }
  if (!score) return null;

  return (
    <section aria-labelledby="score-jour-titre" className={`${card} flex items-center gap-4`}>
      <ProgressRing size={76} strokeWidth={8} pct={score.pct / 100} color="var(--accent-kcal)">
        <span className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
          {score.pct}
          <span className="text-[12px] font-semibold text-ink-3">%</span>
        </span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <h2 id="score-jour-titre" className={sectionTitle}>
          Score du jour
        </h2>
        <dl className="mt-1.5 flex flex-col gap-1">
          {score.lignes.map((ligne) => (
            <div key={ligne.domaine} className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <dt className="text-ink-2">{ligne.libelle}</dt>
              <dd className="truncate font-semibold tabular-nums text-ink">{ligne.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
