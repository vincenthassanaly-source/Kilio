import { afterEach, describe, expect, it, vi } from "vitest";
import { genererApercu, genererTranches } from "./apercu";
import type { Trait } from "./traits";

type Appel = [string, ...unknown[]];

// Faux canvas 2D qui enregistre les appels : jsdom n'implémente pas le dessin.
function fauxCanvas() {
  const appels: Appel[] = [];
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"])) };
  const ctx: Record<string | symbol, unknown> = new Proxy({ canvas } as Record<string | symbol, unknown>, {
    get: (cible, nom) => (nom in cible ? cible[nom] : (...args: unknown[]) => void appels.push([String(nom), ...args])),
    set: (cible, nom, valeur) => {
      cible[nom] = valeur;
      return true;
    },
  });
  return { canvas, appels };
}

const trait: Trait = { e: 2, p: [100, 100, 50, 300, 200, 50] };

afterEach(() => vi.restoreAllMocks());

describe("genererApercu", () => {
  it("ne génère rien pour une feuille vide", async () => {
    expect(await genererApercu([])).toBeNull();
  });

  it("produit un PNG portrait 3:4, comme les cases du calendrier", async () => {
    const { canvas } = fauxCanvas();
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
    expect(await genererApercu([trait])).toBeInstanceOf(Blob);
    expect(canvas.width / canvas.height).toBeCloseTo(3 / 4);
  });

  it("peint le fond sur TOUT le canvas : repère réinitialisé avant le remplissage", async () => {
    // Régression : le fond était peint sous l'échelle du dessin (0,48) et ne couvrait
    // qu'un coin ; le reste restait transparent (« moitié noir, moitié blanc »).
    const { canvas, appels } = fauxCanvas();
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
    await genererApercu([trait]);

    const remplissage = appels.findIndex(([nom]) => nom === "fillRect");
    expect(remplissage).toBeGreaterThan(-1);
    expect(appels[remplissage]).toEqual(["fillRect", 0, 0, canvas.width, canvas.height]);
    const dernierRepere = appels.slice(0, remplissage).reverse().find(([nom]) => nom === "setTransform");
    expect(dernierRepere).toEqual(["setTransform", 1, 0, 0, 1, 0, 0]);
  });
});

describe("genererTranches", () => {
  const traitBas: Trait = { e: 2, p: [100, 100, 50, 300, 3000, 50] };

  it("ne génère rien pour une feuille vide", async () => {
    expect(await genererTranches([])).toBeNull();
  });

  it("rend une image par tranche, à l'échelle 1 (1000 px de large), lisible pour Gemini", async () => {
    const creations: Array<{ width: number; height: number }> = [];
    vi.spyOn(document, "createElement").mockImplementation(() => {
      const f = fauxCanvas();
      creations.push(f.canvas);
      return f.canvas as unknown as HTMLCanvasElement;
    });
    const r = await genererTranches([traitBas]);
    expect(r?.blobs.length).toBe(3);
    expect(r?.tronquee).toBe(false);
    expect(creations).toHaveLength(3);
    for (const c of creations) expect([c.width, c.height]).toEqual([1000, 1400]);
  });

  it("peint un fond opaque sur toute chaque tranche", async () => {
    const f = fauxCanvas();
    vi.spyOn(document, "createElement").mockReturnValue(f.canvas as unknown as HTMLCanvasElement);
    await genererTranches([{ e: 1, p: [10, 10, 50, 20, 20, 50] }]);
    const remplissage = f.appels.findIndex(([nom]) => nom === "fillRect");
    expect(f.appels[remplissage]).toEqual(["fillRect", 0, 0, 1000, 1400]);
    const repere = f.appels.slice(0, remplissage).reverse().find(([nom]) => nom === "setTransform");
    expect(repere).toEqual(["setTransform", 1, 0, 0, 1, 0, 0]);
  });
});
