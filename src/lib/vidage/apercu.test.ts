import { afterEach, describe, expect, it, vi } from "vitest";
import { genererApercu } from "./apercu";
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
