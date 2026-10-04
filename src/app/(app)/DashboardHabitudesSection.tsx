"use client";

import { useQuery } from "@tanstack/react-query";
import { getHabitudesDuJour } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { DashboardHabitItem } from "./DashboardHabitItem";

export function DashboardHabitudesSection({ today, className = "mt-4" }: { today: string; className?: string }) {
  const { data: habitudes, isLoading } = useQuery({
    queryKey: queryKeys.habitudes(today),
    queryFn: () => getHabitudesDuJour(today),
  });

  return (
    <div className={`${className} flex flex-col gap-2.5`}>
      <span
        className="px-0.5 text-[14px] font-semibold text-ink"
        style={{ viewTransitionName: "habitudes-titre-dashboard" }}
      >
        Habitudes
      </span>
      {isLoading ? (
        <div className="flex gap-3 overflow-x-hidden pb-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[50px] w-[50px] shrink-0 rounded-full" />
          ))}
        </div>
      ) : !habitudes || habitudes.length === 0 ? (
        <p className="px-0.5 text-[13.5px] text-ink-2">Aucune habitude pour l&apos;instant.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-0.5" data-swipe-ignore>
          {habitudes.map((h) => (
            <DashboardHabitItem key={h.id} habitude={h} date={today} />
          ))}
        </div>
      )}
    </div>
  );
}
