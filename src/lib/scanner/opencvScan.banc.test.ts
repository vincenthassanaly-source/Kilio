// @vitest-environment node
// Banc d'essai d'OpenCV sur les mêmes scènes difficiles que l'ancien pipeline
// (detection.banc.test.ts) : ombre, perspective forte, carte, bruit, faible contraste.
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Cv } from "./opencv";
import { detecterDocumentCv } from "./opencvScan";
import { erreurCoins, sceneLimite, scenesDeReference } from "./scenes";

const SEUIL_ERREUR = 0.03;
const rapport: string[] = [];
let cv: Cv;

beforeAll(async () => {
  const brut = createRequire(import.meta.url)("@techstark/opencv-js");
  // Le module est « thenable » : on l'enveloppe pour ne jamais le passer à resolve().
  const { module } = await new Promise<{ module: Cv }>((resolve) =>
    brut.Mat ? resolve({ module: brut }) : brut.then((m: Cv) => resolve({ module: m }))
  );
  cv = module;
}, 60_000);

describe("banc de détection OpenCV", () => {
  afterAll(() => {
    console.log("\n=== Banc OpenCV ===\n" + rapport.join("\n"));
  });

  for (const scene of scenesDeReference()) {
    it(`${scene.nom} : coins à moins de ${SEUIL_ERREUR * 100} % de la diagonale`, () => {
      const debut = performance.now();
      const quad = detecterDocumentCv(cv, scene.image);
      const duree = performance.now() - debut;
      if (!quad) rapport.push(`${scene.nom.padEnd(44)} NON DÉTECTÉE`);
      expect(quad, "aucun document détecté").not.toBeNull();
      const erreur = erreurCoins(quad!, scene.verite, scene.image.width, scene.image.height);
      rapport.push(`${scene.nom.padEnd(44)} erreur ${(erreur * 100).toFixed(2)} %  (${duree.toFixed(0)} ms)`);
      expect(erreur).toBeLessThan(SEUIL_ERREUR);
    });
  }

  it("cas limite : si un cadre est proposé il doit être juste", () => {
    const scene = sceneLimite();
    const quad = detecterDocumentCv(cv, scene.image);
    if (!quad) {
      rapport.push(`${scene.nom.padEnd(44)} non détectée (accepté : cadre par défaut)`);
      return;
    }
    const erreur = erreurCoins(quad, scene.verite, scene.image.width, scene.image.height);
    rapport.push(`${scene.nom.padEnd(44)} erreur ${(erreur * 100).toFixed(2)} %`);
    expect(erreur).toBeLessThan(0.06);
  });
});
