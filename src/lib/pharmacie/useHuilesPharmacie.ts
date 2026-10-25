"use client";

import { useQuery } from "@tanstack/react-query";
import { getHuilesSnapshot } from "@/app/actions/huiles";
import { queryKeys } from "@/lib/query/keys";
import { enregistrerHuilesLocal, lireHuilesLocal } from "./cache";
import type { HuilesSnapshot } from "./huiles";

async function chargerHuiles(): Promise<HuilesSnapshot> {
  try {
    const snapshot = await getHuilesSnapshot();
    void enregistrerHuilesLocal(snapshot);
    return snapshot;
  } catch (err) {
    // Hors ligne : on retombe sur la dernière copie locale.
    const local = await lireHuilesLocal();
    if (local) return local;
    throw err;
  }
}

export function useHuilesPharmacie() {
  return useQuery({ queryKey: queryKeys.pharmacieHuiles, queryFn: chargerHuiles });
}
