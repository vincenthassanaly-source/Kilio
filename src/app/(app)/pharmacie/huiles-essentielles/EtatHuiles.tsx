"use client";

import type { ReactNode } from "react";
import { errorText } from "@/lib/ui";
import { useHuilesPharmacie } from "@/lib/pharmacie/useHuilesPharmacie";
import type { HuilesSnapshot } from "@/lib/pharmacie/huiles";
import { PharmacieSkeleton } from "../EtatSnapshot";

// Coquille commune aux écrans des huiles essentielles : chargement, erreur,
// puis rendu avec l'instantané (jamais de rendu partiel).
export function AvecHuiles({ children }: { children: (snapshot: HuilesSnapshot) => ReactNode }) {
  const { data, isLoading, isError } = useHuilesPharmacie();

  if (isLoading) return <PharmacieSkeleton />;
  if (isError || !data) {
    return <p className={errorText}>Impossible de charger les huiles essentielles. Réessaie une fois en ligne.</p>;
  }
  return <>{children(data)}</>;
}
