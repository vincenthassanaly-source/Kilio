import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = { cle: string; valeur: unknown; enregistre_le: string };

// Faux Dexie : seule la table cache_lecture est utilisée par cache.ts.
const etat = vi.hoisted(() => ({ lignes: new Map<string, unknown>(), indisponible: false }));

vi.mock("@/lib/offline/queue", () => ({
  preloadOfflineDb: async () => {
    if (etat.indisponible) throw new Error("IndexedDB indisponible");
    return {
      cache_lecture: {
        put: async (ligne: Ligne) => void etat.lignes.set(ligne.cle, ligne),
        get: async (cle: string) => etat.lignes.get(cle),
      },
    };
  },
}));

import {
  enregistrerReferentielLocal,
  enregistrerSnapshotLocal,
  lireReferentielLocal,
  lireSnapshotLocal,
} from "./cache";

const snapshot = { matieres: [], chapitres: [], notions: [], cartes: [], genereLe: "2026-10-09T10:00:00.000Z" };
const referentiel = { classes: [], molecules: [], specialites: [], pathologies: [], lignes: [], items: [], genereLe: "2026-10-09T10:00:00.000Z" };

beforeEach(() => {
  etat.lignes.clear();
  etat.indisponible = false;
});

describe("cache local de la pharmacie", () => {
  it("relit ce qu'il a enregistré, pour le snapshot comme pour le référentiel", async () => {
    await enregistrerSnapshotLocal(snapshot as never);
    await enregistrerReferentielLocal(referentiel as never);

    expect(await lireSnapshotLocal()).toEqual(snapshot);
    expect(await lireReferentielLocal()).toEqual(referentiel);
  });

  it("garde les deux copies sous des clés distinctes, avec la date d'enregistrement", async () => {
    await enregistrerSnapshotLocal(snapshot as never);
    await enregistrerReferentielLocal(referentiel as never);

    expect([...etat.lignes.keys()].sort()).toEqual(["pharmacie-referentiel-snapshot", "pharmacie-snapshot"]);
    const ligne = etat.lignes.get("pharmacie-snapshot") as Ligne;
    expect(Number.isNaN(Date.parse(ligne.enregistre_le))).toBe(false);
  });

  it("renvoie null quand rien n'a été enregistré", async () => {
    expect(await lireSnapshotLocal()).toBeNull();
    expect(await lireReferentielLocal()).toBeNull();
  });

  it("avale l'indisponibilité du stockage : lecture à null, écriture sans erreur", async () => {
    etat.indisponible = true;
    await expect(enregistrerSnapshotLocal(snapshot as never)).resolves.toBeUndefined();
    await expect(enregistrerReferentielLocal(referentiel as never)).resolves.toBeUndefined();
    expect(await lireSnapshotLocal()).toBeNull();
    expect(await lireReferentielLocal()).toBeNull();
  });
});
