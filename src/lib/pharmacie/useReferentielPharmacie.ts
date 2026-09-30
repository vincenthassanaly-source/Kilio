"use client";

import { useQuery } from "@tanstack/react-query";
import { getReferentielSnapshot } from "@/app/actions/pharmacie";
import { queryKeys } from "@/lib/query/keys";
import { enregistrerReferentielLocal, lireReferentielLocal } from "./cache";
import type { PharmaRefSnapshot } from "./referentiel";

async function chargerReferentiel(): Promise<PharmaRefSnapshot> {
  try {
    const snapshot = await getReferentielSnapshot();
    void enregistrerReferentielLocal(snapshot);
    return snapshot;
  } catch (err) {
    // Hors ligne : on retombe sur la dernière copie locale.
    const local = await lireReferentielLocal();
    if (local) return local;
    throw err;
  }
}

export function useReferentielPharmacie() {
  return useQuery({ queryKey: queryKeys.pharmacieReferentiel, queryFn: chargerReferentiel });
}
