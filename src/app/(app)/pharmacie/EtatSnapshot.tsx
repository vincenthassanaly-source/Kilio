"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { card, errorText } from "@/lib/ui";
import { useSnapshotPharmacie } from "@/lib/pharmacie/useSnapshotPharmacie";
import type { PharmaSnapshot } from "@/lib/pharmacie/types";

export function PharmacieSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-11 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-[24px]" />
      <Skeleton className="h-20 w-full rounded-[20px]" />
      <Skeleton className="h-20 w-full rounded-[20px]" />
    </div>
  );
}

// Coquille commune aux écrans du module : chargement, erreur, puis rendu du
// contenu avec l'instantané (jamais de rendu partiel).
export function AvecSnapshot({ children }: { children: (snapshot: PharmaSnapshot) => ReactNode }) {
  const { data, isLoading, isError } = useSnapshotPharmacie();

  if (isLoading) return <PharmacieSkeleton />;
  if (isError || !data) {
    return <p className={errorText}>Impossible de charger la Pharmacie. Réessaie une fois en ligne.</p>;
  }
  return <>{children(data)}</>;
}

export function IntrouvableCarte({ message }: { message: string }) {
  return (
    <div className={`${card} text-[14.5px] text-ink-2`} role="status">
      {message}
    </div>
  );
}
