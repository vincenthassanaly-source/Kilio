"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getResumeNutritionJour } from "@/app/actions/journal";
import { queryKeys } from "@/lib/query/keys";
import { repasRestants, type Restant } from "@/lib/aujourdhui/compute";
import { card } from "@/lib/ui";
import { Skeleton } from "@/components/skeletons/Skeleton";

function Macro({ lettre, restant }: { lettre: string; restant: Restant }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-semibold text-ink-3">{lettre}</dt>
      <dd className={`text-[13.5px] font-semibold tabular-nums ${restant.depasse ? "text-alert" : "text-ink"}`}>
        {restant.depasse ? "+" : ""}
        {restant.valeur} g
      </dd>
    </div>
  );
}

/**
 * Ce qu'il reste à manger aujourd'hui (kcal et macros) par rapport à la cible
 * du type de jour. Sans objectif défini, la carte invite à en créer un plutôt
 * que d'inventer une cible.
 */
export function RepasRestantsCard({ today }: { today: string }) {
  const { data: resume, isLoading } = useQuery({
    queryKey: queryKeys.resumeNutrition(today),
    queryFn: () => getResumeNutritionJour(today),
  });

  if (isLoading) {
    return (
      <div className={`${card} flex flex-col gap-2`}>
        <Skeleton className="h-3.5 w-1/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  const reste = resume ? repasRestants(resume.consomme, resume.kcalGoal, resume.macroGoals) : null;

  return (
    <Link
      href="/nutrition/journal"
      className={`${card} flex flex-col gap-2.5 transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Repas</h2>
        <span className="text-[13px] font-semibold text-kcal">Ajouter un repas</span>
      </div>
      {reste ? (
        <>
          <p className={`text-[13.5px] tabular-nums ${reste.kcal.depasse ? "text-alert" : "text-ink"}`}>
            <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">{reste.kcal.valeur}</span>{" "}
            kcal {reste.kcal.depasse ? "au-dessus de l'objectif" : "restantes"}
          </p>
          <dl className="grid grid-cols-3 gap-3">
            <Macro lettre="Protéines" restant={reste.proteines} />
            <Macro lettre="Glucides" restant={reste.glucides} />
            <Macro lettre="Lipides" restant={reste.lipides} />
          </dl>
        </>
      ) : (
        <p className="text-[13.5px] text-ink-2">
          {Math.round(resume?.consomme.kcal ?? 0)} kcal aujourd&apos;hui · objectif à définir
        </p>
      )}
    </Link>
  );
}
