import type { PharmaSnapshot } from "./types";

const CLE = "pharmacie-snapshot";

// Copie locale (Dexie, chargé à la demande comme pour la file hors ligne) :
// toute erreur est avalée, le cache n'est qu'un repli de confort.
export async function enregistrerSnapshotLocal(snapshot: PharmaSnapshot): Promise<void> {
  try {
    const { preloadOfflineDb } = await import("@/lib/offline/queue");
    const db = await preloadOfflineDb();
    await db.cache_lecture.put({ cle: CLE, valeur: snapshot, enregistre_le: new Date().toISOString() });
  } catch {
    // stockage indisponible (navigation privée, quota) : on continue sans copie
  }
}

export async function lireSnapshotLocal(): Promise<PharmaSnapshot | null> {
  try {
    const { preloadOfflineDb } = await import("@/lib/offline/queue");
    const db = await preloadOfflineDb();
    const ligne = await db.cache_lecture.get(CLE);
    return (ligne?.valeur as PharmaSnapshot | undefined) ?? null;
  } catch {
    return null;
  }
}
