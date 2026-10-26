"use client";

import type { ReactNode } from "react";
import { useHuilesPharmacie } from "@/lib/pharmacie/useHuilesPharmacie";
import type { HuilesSnapshot } from "@/lib/pharmacie/huiles";
import { PharmacieSkeleton } from "../EtatSnapshot";
import { ErrorInline } from "@/components/ErrorInline";

// Coquille commune aux écrans des huiles essentielles : chargement, erreur,
// puis rendu avec l'instantané (jamais de rendu partiel).
export function AvecHuiles({ children }: { children: (snapshot: HuilesSnapshot) => ReactNode }) {
  const { data, isLoading, isError, refetch } = useHuilesPharmacie();

  if (isLoading) return <PharmacieSkeleton />;
  if (isError || !data) {
    return <ErrorInline message="Impossible de charger les huiles essentielles. Vérifie ta connexion." retry={() => refetch()} />;
  }
  return <>{children(data)}</>;
}
