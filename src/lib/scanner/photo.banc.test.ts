// @vitest-environment node
// Banc de la chaîne de production sur une photo (detecterPhoto = detecterFeuilleAuto avec `cv`
// injecté) : vote OpenCV multi-échelles, extension, affinage. Les bancs bruts (detection.banc,
// opencvScan.banc) ne voyaient pas qu'une étape ultérieure pouvait abîmer un cadre juste.
// Coins comparés sans tenir compte de leur ordre.
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reduirePourDetection } from "./detection";
import { mettreAEchelle, type Quad } from "./geometrie";
import type { Cv } from "./opencv";
import { detecterDocumentCv } from "./opencvScan";
import { etendreAuxBordsDeLaFeuille } from "./extension";
import { detecterPhoto, finaliserCadre } from "./pipeline";
import { sceneLimite, scenesDeReference, type Scene } from "./scenes";
import { coinsDistincts, erreurCoinsSansOrdre, iouQuads, sceneRotation45, scenesCadreInterieur, scenesDifficiles, veriteVisible } from "./scenesEtendues";

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

const sansPause = { ceder: async () => {} };

type Mesure = { erreur: number; iou: number; direct: number | null };

/** Chaîne photo complète, et direct OpenCV (360 px, comme le viseur) pour comparaison. */
async function mesurer(scene: Scene): Promise<Mesure> {
  const { width: w, height: h } = scene.image;
  const verite = veriteVisible(scene);
  const quad = await detecterPhoto(cv, scene.image, sansPause);
  const { image, facteur } = reduirePourDetection(scene.image, 360);
  const live = detecterDocumentCv(cv, image, 360);
  const direct = live ? erreurCoinsSansOrdre(mettreAEchelle(live, facteur), verite, w, h) : null;
  const erreur = quad ? erreurCoinsSansOrdre(quad, verite, w, h) : Infinity;
  const iou = quad ? iouQuads(quad, verite, w, h) : 0;
  const pct = (x: number | null) => (x === null ? "  —  " : `${(x * 100).toFixed(2)} %`);
  rapport.push(`${scene.nom.padEnd(46)} photo ${pct(erreur)} (IoU ${iou.toFixed(3)})  direct ${pct(direct)}`);
  return { erreur, iou, direct };
}

/** Règle du lot 1 : la chaîne photo ne fait jamais pire que le direct OpenCV (marge de 0,2 point). */
function pasPireQueLeDirect(m: Mesure) {
  if (m.direct !== null) expect(m.erreur, "chaîne photo pire que le direct").toBeLessThanOrEqual(Math.max(m.direct + 0.002, 0.015));
}

describe("banc de la chaîne photo (detecterFeuilleAuto)", () => {
  afterAll(() => {
    console.log("\n=== Banc chaîne photo ===\n" + rapport.join("\n"));
  });

  for (const scene of [...scenesDeReference(), sceneLimite()]) {
    it(`référence — ${scene.nom} : coins à moins de 3 %, pas pire que le direct`, async () => {
      const m = await mesurer(scene);
      expect(m.erreur).toBeLessThan(0.03);
      pasPireQueLeDirect(m);
    });
  }

  const [blanc12, blanc8, nappe, coinHors, plusHaute] = scenesDifficiles();

  for (const scene of [blanc12, blanc8, nappe]) {
    it(`${scene.nom} : erreur ≤ 1,5 % et IoU ≥ 0,95`, async () => {
      const m = await mesurer(scene);
      expect(m.erreur).toBeLessThanOrEqual(0.015);
      expect(m.iou).toBeGreaterThanOrEqual(0.95);
      pasPireQueLeDirect(m);
    });
  }

  it(`${coinHors.nom} : erreur ≤ 3 %`, async () => {
    const m = await mesurer(coinHors);
    expect(m.erreur).toBeLessThanOrEqual(0.03);
  });

  it(`${plusHaute.nom} : erreur ≤ 1,5 % (l'extension doit continuer à servir les pages qui débordent)`, async () => {
    const m = await mesurer(plusHaute);
    expect(m.erreur).toBeLessThanOrEqual(0.015);
  });
});

// Revue du lot 1 : un trait sombre juste derrière le côté (ligne de texte, cadre imprimé) passait pour
// le bord de la page et bloquait l'extension (6,75 % d'erreur au lieu de 0,23 %).
describe("cadre intérieur avec un trait juste derrière un côté", () => {
  for (const { scene, interieur } of scenesCadreInterieur()) {
    it(`${scene.nom} : l'extension rejoint le vrai bord (≤ 1,5 %)`, () => {
      const { width: w, height: h } = scene.image;
      expect(erreurCoinsSansOrdre(etendreAuxBordsDeLaFeuille(scene.image, interieur), scene.verite, w, h)).toBeLessThanOrEqual(0.015);
      expect(erreurCoinsSansOrdre(finaliserCadre(scene.image, interieur), scene.verite, w, h)).toBeLessThanOrEqual(0.015);
    });
    it(`${scene.nom} : chaîne photo complète ≤ 1,5 %`, async () => {
      const m = await mesurer(scene);
      expect(m.erreur).toBeLessThanOrEqual(0.015);
    });
  }
});

describe("feuille tournée de 45°", () => {
  const { scene, coins } = sceneRotation45();

  it("la vérité terrain garde 4 coins distincts", () => {
    expect(coinsDistincts(scene.verite)).toBe(true);
  });

  it("la chaîne photo retrouve les 4 coins (comparaison sans ordre, contre les coins d'origine)", async () => {
    const quad: Quad | null = await detecterPhoto(cv, scene.image, sansPause);
    expect(quad).not.toBeNull();
    expect(coinsDistincts(quad!)).toBe(true);
    expect(erreurCoinsSansOrdre(quad!, coins, 640, 480)).toBeLessThan(0.015);
  });
});
