"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getResumeNutritionJour } from "@/app/actions/journal";
import { queryKeys } from "@/lib/query/keys";
import { repasRestants, type Restant } from "@/lib/aujourdhui/compute";
import { card } from "@/lib/ui";
import { ErrorInline } from "@/components/ErrorInline";
import { Skeleton } from "@/components/skeletons/Skeleton";

function Macro({ lettre, restant }: { lettre: string; restant: Restant }) {
  return (
    <div className="flex flex-col">
      <dt className="text-micro font-semibold text-ink-3">{lettre}</dt>
      <dd className={`text-label font-semibold tabular-nums ${restant.depasse ? "text-alert" : "text-ink"}`}>
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
  const { data: resume, isLoading, isError, refetch } = useQuery({
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

  if (isError && !resume) {
    return (
      <div className={card}>
        <ErrorInline message="Repas indisponibles pour le moment." retry={() => void refetch()} />
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
        <h2 className="text-body font-semibold tracking-[-0.01em] text-ink">Repas</h2>
        <span className="text-small font-semibold text-kcal">Ajouter un repas</span>
      </div>
      {resume?.jourLibre ? (
        <p className="text-label leading-snug text-ink-2">
          <span className="font-display text-heading font-semibold tracking-[-0.02em] text-ink">Jour libre</span>
          <br />
          {Math.round(resume.consomme.kcal)} kcal saisies · pas de limite aujourd&apos;hui
        </p>
      ) : reste ? (
        <>
          <p className={`text-label tabular-nums ${reste.kcal.depasse ? "text-alert" : "text-ink"}`}>
            <span className="font-display text-heading font-semibold tracking-[-0.02em]">{reste.kcal.valeur}</span>{" "}
            kcal {reste.kcal.depasse ? "au-dessus de l'objectif" : "restantes"}
          </p>
          <dl className="grid grid-cols-3 gap-3">
            <Macro lettre="Protéines" restant={reste.proteines} />
            <Macro lettre="Glucides" restant={reste.glucides} />
            <Macro lettre="Lipides" restant={reste.lipides} />
          </dl>
        </>
      ) : (
        <p className="text-label text-ink-2">
          {Math.round(resume?.consomme.kcal ?? 0)} kcal aujourd&apos;hui · objectif à définir
        </p>
      )}
    </Link>
  );
}
