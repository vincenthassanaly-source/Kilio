import { describe, expect, it, vi } from "vitest";
import { erreurCoins, scenesDeReference } from "./scenes";

// OpenCV qui n'arrive qu'à la demande : simule un premier usage en réseau lent, ou bloqué.
let liberer: (v: { cv: unknown }) => void = () => {};
vi.mock("./opencv", () => ({
  chargerOpenCv: () => new Promise((resolve) => (liberer = resolve)),
  openCvSiPret: () => null,
}));
const cvAppele = vi.fn();
vi.mock("./pipeline", async (original) => {
  const vrai = await original<typeof import("./pipeline")>();
  return {
    ...vrai,
    detecterPhoto: (cv: unknown, source: Parameters<typeof vrai.detecterPhoto>[1]) => {
      if (cv) {
        cvAppele();
        return Promise.resolve([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }]);
      }
      return vrai.detecterPhoto(null, source);
    },
  };
});

const { detecterFeuilleAuto, redresserPourPage } = await import("./traitement");

describe("recadrage sans attendre OpenCV", () => {
  const scene = scenesDeReference()[3]; // feuille sur fond sombre

  it("propose le cadre maison après le délai, puis le cadre OpenCV quand il arrive", async () => {
    const surAmelioration = vi.fn();
    const quad = await detecterFeuilleAuto(scene.image, { delaiMs: 30, surAmelioration });
    expect(quad).not.toBeNull();
    expect(erreurCoins(quad!, scene.verite, scene.image.width, scene.image.height)).toBeLessThan(0.03);
    expect(surAmelioration).not.toHaveBeenCalled();
    liberer({ cv: {} });
    await vi.waitFor(() => expect(surAmelioration).toHaveBeenCalledTimes(1));
    expect(cvAppele).toHaveBeenCalledTimes(1);
  });
});

describe("« Ajouter la page » sans attendre OpenCV", () => {
  it("redresse la page en moins d'une seconde quand OpenCV n'arrive pas (redressement maison)", async () => {
    // Régression (revue du lot 1) : creerPage attendait chargerOpenCv(), donc jusqu'à 45 s de « Traitement… ».
    const scene = scenesDeReference()[3];
    const debut = performance.now();
    const page = await Promise.race([
      redresserPourPage(scene.image, scene.verite),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    expect(page, "redressement bloqué par le chargement d'OpenCV").not.toBeNull();
    expect(performance.now() - debut).toBeLessThan(1000);
  });
});
