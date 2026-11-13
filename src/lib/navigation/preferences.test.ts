import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  single: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife, cacheTag: mocks.cacheTag }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { DEFAULT_MODULES_BARRE_BASSE, NAV_ITEMS } from "./registry";
import { getPreferencesNavigationResolues, PREFERENCES_NAVIGATION_TAG, resolveModulesBarreBasse } from "./preferences";

const tousLesHrefs = NAV_ITEMS.map((i) => i.href);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.createAdminClient.mockReturnValue({
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
  });
});

describe("getPreferencesNavigationResolues", () => {
  it("applique l'ordre enregistré et ajoute les modules manquants en fin de grille", async () => {
    const [a, b] = tousLesHrefs;
    mocks.single.mockResolvedValue({
      data: { ordre_grille_plus: [b, a], modules_barre_basse: [] },
      error: null,
    });

    const res = await getPreferencesNavigationResolues();

    expect(res.ordreGrillePlus.slice(0, 2)).toEqual([b, a]);
    expect([...res.ordreGrillePlus].sort()).toEqual([...tousLesHrefs].sort());
    expect(mocks.cacheTag).toHaveBeenCalledWith(PREFERENCES_NAVIGATION_TAG);
    expect(mocks.cacheLife).toHaveBeenCalledWith("days");
  });

  it("fait apparaître la Revue en fin de grille même si l'ordre enregistré ne la contient pas", async () => {
    const sansRevue = tousLesHrefs.filter((href) => href !== "/revue").reverse();
    mocks.single.mockResolvedValue({
      data: { ordre_grille_plus: sansRevue, modules_barre_basse: [] },
      error: null,
    });

    const res = await getPreferencesNavigationResolues();

    expect(tousLesHrefs).toContain("/revue");
    expect(res.ordreGrillePlus).toEqual([...sansRevue, "/revue"]);
    // Jamais épinglée par défaut à la barre du bas.
    expect(DEFAULT_MODULES_BARRE_BASSE).not.toContain("/revue");
    expect(res.modulesBarreBasse).not.toContain("/revue");
  });

  it("ignore les hrefs inconnus et dédoublonne via le registre", async () => {
    mocks.single.mockResolvedValue({
      data: { ordre_grille_plus: ["/module-supprime", tousLesHrefs[0]], modules_barre_basse: [] },
      error: null,
    });

    const res = await getPreferencesNavigationResolues();

    expect(res.ordreGrillePlus).not.toContain("/module-supprime");
    expect(res.ordreGrillePlus).toHaveLength(tousLesHrefs.length);
  });

  it("garde les emplacements enregistrés de la barre du bas et complète par défaut", async () => {
    const perso = tousLesHrefs.find((h) => !DEFAULT_MODULES_BARRE_BASSE.includes(h))!;
    mocks.single.mockResolvedValue({
      data: { ordre_grille_plus: [], modules_barre_basse: [perso, "/inconnu"] },
      error: null,
    });

    const res = await getPreferencesNavigationResolues();

    expect(res.modulesBarreBasse[0]).toBe(perso);
    expect(res.modulesBarreBasse[1]).toBe(DEFAULT_MODULES_BARRE_BASSE[1]);
    expect(res.modulesBarreBasse).toHaveLength(DEFAULT_MODULES_BARRE_BASSE.length);
  });

  it("nettoie le module retiré « /objectifs » encore présent dans la ligne en base", async () => {
    mocks.single.mockResolvedValue({
      data: {
        ordre_grille_plus: ["/objectifs", tousLesHrefs[1], tousLesHrefs[0]],
        modules_barre_basse: ["/objectifs", "/agenda", "/objectifs"],
      },
      error: null,
    });

    const res = await getPreferencesNavigationResolues();

    expect(tousLesHrefs).not.toContain("/objectifs");
    expect(res.ordreGrillePlus).not.toContain("/objectifs");
    expect(res.ordreGrillePlus.slice(0, 2)).toEqual([tousLesHrefs[1], tousLesHrefs[0]]);
    expect(res.ordreGrillePlus).toHaveLength(tousLesHrefs.length);
    expect(res.modulesBarreBasse).not.toContain("/objectifs");
    expect(res.modulesBarreBasse).toHaveLength(DEFAULT_MODULES_BARRE_BASSE.length);
    expect(new Set(res.modulesBarreBasse).size).toBe(res.modulesBarreBasse.length);
  });

  it("retombe sur l'ordre par défaut avec un cache court si Supabase renvoie une erreur", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "panne" } });

    const res = await getPreferencesNavigationResolues();

    expect(res.ordreGrillePlus).toEqual(tousLesHrefs);
    expect(res.modulesBarreBasse).toEqual([...DEFAULT_MODULES_BARRE_BASSE]);
    expect(mocks.cacheLife).toHaveBeenCalledWith("minutes");
    expect(mocks.cacheLife).not.toHaveBeenCalledWith("days");
  });

  it("retombe aussi sur le défaut si le client ne peut pas être créé", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
    });

    const res = await getPreferencesNavigationResolues();

    expect(res.ordreGrillePlus).toEqual(tousLesHrefs);
    expect(mocks.cacheLife).toHaveBeenCalledWith("minutes");
  });
});

describe("resolveModulesBarreBasse", () => {
  it("n'affiche jamais deux fois le même module dans la barre", () => {
    // Préférences d'avant la fusion : « /aujourdhui » en tête, « /taches » choisi
    // en 3e position, 4e emplacement absent (le défaut « /taches » ferait doublon).
    const res = resolveModulesBarreBasse(["/aujourdhui", "/agenda", "/taches"]);

    expect(new Set(res).size).toBe(res.length);
    expect(res.slice(0, 3)).toEqual(["/", "/agenda", "/taches"]);
  });

  it("garde les choix enregistrés quand ils sont valides et distincts", () => {
    expect(resolveModulesBarreBasse(["/", "/agenda", "/nutrition", "/habitudes"])).toEqual([
      "/",
      "/agenda",
      "/nutrition",
      "/habitudes",
    ]);
  });

  it("retombe sur les défauts quand rien n'est enregistré", () => {
    expect(resolveModulesBarreBasse([])).toEqual([...DEFAULT_MODULES_BARRE_BASSE]);
  });
});
