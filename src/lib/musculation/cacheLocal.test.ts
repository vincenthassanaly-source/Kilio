import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = new Map<string, { cle: string; valeur: unknown }>();

vi.mock("@/lib/offline/db", () => ({
  db: {
    cache_lecture: {
      get: async (cle: string) => magasin.get(cle),
      put: async (ligne: { cle: string; valeur: unknown }) => {
        magasin.set(ligne.cle, ligne);
      },
    },
  },
}));
vi.mock("@/app/actions/musculation", () => ({ getExercices: vi.fn(), getRoutine: vi.fn(), getRoutines: vi.fn() }));

import { avecCacheLocal } from "./cacheLocal";

describe("avecCacheLocal", () => {
  beforeEach(() => magasin.clear());

  it("sert le réseau et garde une copie", async () => {
    await expect(avecCacheLocal("a", async () => [1, 2])).resolves.toEqual([1, 2]);
    expect(magasin.get("musculation:a")?.valeur).toEqual([1, 2]);
  });

  it("sans copie, l'erreur réseau remonte", async () => {
    await expect(
      avecCacheLocal("a", async () => {
        throw new Error("Failed to fetch");
      }),
    ).rejects.toThrow("Failed to fetch");
  });

  it("avec une copie, une erreur réseau sert la copie", async () => {
    magasin.set("musculation:a", { cle: "musculation:a", valeur: ["copie"] });
    await expect(
      avecCacheLocal("a", async () => {
        throw new Error("Failed to fetch");
      }),
    ).resolves.toEqual(["copie"]);
  });

  it("avec une copie, un réseau trop lent sert la copie", async () => {
    magasin.set("musculation:a", { cle: "musculation:a", valeur: ["copie"] });
    const lent = () => new Promise<string[]>((resolve) => setTimeout(() => resolve(["reseau"]), 200));
    await expect(avecCacheLocal("a", lent, 10)).resolves.toEqual(["copie"]);
  });

  it("ne garde pas un résultat null (introuvable)", async () => {
    await avecCacheLocal("a", async () => null);
    expect(magasin.has("musculation:a")).toBe(false);
  });
});
