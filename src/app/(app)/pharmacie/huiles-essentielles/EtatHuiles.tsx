"use client";

import { useMemo, type ReactNode } from "react";
import { useHuilesPharmacie } from "@/lib/pharmacie/useHuilesPharmacie";
import { useMasques } from "@/lib/actions/elementsMasques";
import type { HuilesSnapshot } from "@/lib/pharmacie/huiles";
import { PharmacieSkeleton } from "../EtatSnapshot";
import { ErrorInline } from "@/components/ErrorInline";

// Coquille commune aux écrans des huiles essentielles : chargement, erreur,
// puis rendu avec l'instantané (jamais de rendu partiel).
export function AvecHuiles({ children }: { children: (snapshot: HuilesSnapshot) => ReactNode }) {
  const { data: toutes, isLoading, isError, refetch } = useHuilesPharmacie();
  // Huiles en cours de suppression (toast « Annuler » encore affiché) : cachées.
  const masquees = useMasques("huile");
  const data = useMemo(
    () => (toutes && masquees.size > 0 ? { ...toutes, huiles: toutes.huiles.filter((h) => !masquees.has(h.id)) } : toutes),
    [toutes, masquees]
  );

  if (isLoading) return <PharmacieSkeleton />;
  if (isError || !data) {
    return <ErrorInline message="Impossible de charger les huiles essentielles. Vérifie ta connexion." retry={() => refetch()} />;
  }
  return <>{children(data)}</>;
}
