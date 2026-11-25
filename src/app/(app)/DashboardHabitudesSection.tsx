"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getHabitudesDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { ErrorInline } from "@/components/ErrorInline";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { DashboardHabitItem } from "./DashboardHabitItem";
import { sectionTitle } from "@/lib/ui";

export function DashboardHabitudesSection({ today, className = "mt-4" }: { today: string; className?: string }) {
  const { data: habitudes, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.habitudes(today),
    queryFn: () => getHabitudesDuJour(today),
  });

  return (
    <div className={`${className} flex flex-col gap-2.5`}>
      <h2
        className={`px-0.5 ${sectionTitle}`}
        style={{ viewTransitionName: "habitudes-titre-dashboard" }}
      >
        {/* Le titre mène au module : jusqu'ici, le seul lien vers /habitudes était dans l'état vide. */}
        <Link
          href="/habitudes"
          className="relative inline-flex min-h-11 items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        >
          Habitudes
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-3">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </h2>
      {isLoading ? (
        // Même gabarit que les tuiles (anneau + nom) : rien ne saute à l'arrivée.
        <div className="flex gap-3 overflow-x-hidden pb-0.5" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5 pb-1">
              <Skeleton className="h-[50px] w-[50px] rounded-full" />
              <Skeleton className="h-3 w-11 rounded-full" />
            </div>
          ))}
        </div>
      ) : isError && !habitudes ? (
        <ErrorInline message="Habitudes indisponibles pour le moment." retry={() => void refetch()} />
      ) : !habitudes || habitudes.length === 0 ? (
        <p className="flex flex-wrap items-center justify-between gap-x-3 px-0.5 text-label text-ink-2">
          Aucune habitude pour l&apos;instant.
          <Link
            href="/habitudes"
            className="relative inline-flex min-h-11 items-center font-semibold text-kcal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
          >
            Ajouter une habitude
          </Link>
        </p>
      ) : (
        // `-m-1 p-1` : le défilement horizontal rogne aussi en vertical ; ces
        // 4 px gardent visibles l'anneau de focus et l'échelle au toucher.
        <div className="-m-1 flex gap-3 overflow-x-auto p-1 pb-1.5" data-swipe-ignore>
          {habitudes.map((h) => (
            <DashboardHabitItem key={h.id} habitude={h} date={today} />
          ))}
        </div>
      )}
    </div>
  );
}
