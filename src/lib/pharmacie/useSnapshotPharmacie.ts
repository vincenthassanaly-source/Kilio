"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { getPharmacieSnapshot } from "@/app/actions/pharmacie";
import { queryKeys } from "@/lib/query/keys";
import { enregistrerSnapshotLocal, lireSnapshotLocal } from "./cache";
import type { PharmaSnapshot } from "./types";

async function chargerSnapshot(): Promise<PharmaSnapshot> {
  try {
    const snapshot = await getPharmacieSnapshot();
    void enregistrerSnapshotLocal(snapshot);
    return snapshot;
  } catch (err) {
    // Hors ligne (ou serveur injoignable) : on retombe sur la dernière copie
    // locale plutôt que d'afficher une erreur au comptoir.
    const local = await lireSnapshotLocal();
    if (local) return local;
    throw err;
  }
}

export function useSnapshotPharmacie() {
  return useQuery({ queryKey: queryKeys.pharmacie, queryFn: chargerSnapshot });
}

/** Met à jour le cache TanStack Query ET la copie locale (révision optimiste). */
export function modifierSnapshot(queryClient: QueryClient, transformer: (s: PharmaSnapshot) => PharmaSnapshot) {
  const actuel = queryClient.getQueryData<PharmaSnapshot>(queryKeys.pharmacie);
  if (!actuel) return;
  const suivant = transformer(actuel);
  queryClient.setQueryData(queryKeys.pharmacie, suivant);
  void enregistrerSnapshotLocal(suivant);
}
