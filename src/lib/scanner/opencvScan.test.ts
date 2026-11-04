// @vitest-environment node
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import type { Quad } from "./geometrie";
import type { Cv } from "./opencv";
import { detecterDocumentCv, redresserCv } from "./opencvScan";

// Même moteur qu'en production (WASM), chargé sous Node : `cv` est thenable.
let cv: Cv;
beforeAll(async () => {
  const brut = createRequire(import.meta.url)("@techstark/opencv-js");
  // Le module est « thenable » : on l'enveloppe pour ne jamais le passer à resolve().
  const { module } = await new Promise<{ module: Cv }>((resolve) =>
    brut.Mat ? resolve({ module: brut }) : brut.then((m: Cv) => resolve({ module: m }))
  );
  cv = module;
}, 60_000);

const W = 960;
const H = 720;

/** Scène synthétique : fond uni, feuille en perspective avec lignes de « texte » et dégradé d'ombre. */
function scene(fond: number, feuille: number, quad: Quad, ombre = 0) {
  const img = new cv.Mat(H, W, cv.CV_8UC4, new cv.Scalar(fond, fond, fond, 255));
  const pts = cv.matFromArray(4, 1, cv.CV_32SC2, quad.flatMap((p) => [Math.round(p.x), Math.round(p.y)]));
  const mv = new cv.MatVector();
  mv.push_back(pts);
  cv.fillPoly(img, mv, new cv.Scalar(feuille, feuille, feuille - 5, 255));
  const [a, b, c, d] = quad;
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    const p1 = { x: a.x + (d.x - a.x) * t + (b.x - a.x) * 0.1, y: a.y + (d.y - a.y) * t + (b.y - a.y) * 0.1 };
    const p2 = { x: p1.x + (b.x - a.x) * 0.8, y: p1.y + (c.y - d.y) * 0 + (b.y - a.y) * 0.8 };
    cv.line(img, new cv.Point(p1.x, p1.y), new cv.Point(p2.x, p2.y), new cv.Scalar(60, 60, 60, 255), 2);
  }
  if (ombre) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = 1 - (ombre * x) / W;
      const o = (y * W + x) * 4;
      img.data[o] *= k; img.data[o + 1] *= k; img.data[o + 2] *= k;
    }
  }
  const data = new Uint8ClampedArray(img.data);
  [img, pts, mv].forEach((m) => m.delete());
  return { data, width: W, height: H };
}

function erreurMax(trouve: Quad, attendu: Quad): number {
  return Math.max(...attendu.map((p, i) => Math.hypot(p.x - trouve[i].x, p.y - trouve[i].y)));
}

const A4: Quad = [{ x: 190, y: 90 }, { x: 760, y: 70 }, { x: 800, y: 650 }, { x: 150, y: 630 }];
const PETIT: Quad = [{ x: 330, y: 250 }, { x: 640, y: 240 }, { x: 650, y: 470 }, { x: 320, y: 480 }];

describe("detecterDocumentCv", () => {
  it("trouve une feuille claire sur table sombre, en perspective", () => {
    const q = detecterDocumentCv(cv, scene(50, 235, A4))!;
    expect(q).not.toBeNull();
    expect(erreurMax(q, A4)).toBeLessThan(10);
  });

  it("trouve une feuille sur table claire peu contrastée avec dégradé d'ombre", () => {
    const q = detecterDocumentCv(cv, scene(170, 238, A4, 0.35))!;
    expect(q).not.toBeNull();
    expect(erreurMax(q, A4)).toBeLessThan(16);
  });

  it("trouve un document plus petit au milieu de la scène", () => {
    const q = detecterDocumentCv(cv, scene(60, 225, PETIT))!;
    expect(q).not.toBeNull();
    expect(erreurMax(q, PETIT)).toBeLessThan(10);
  });

  it("renvoie null quand il n'y a aucun document", () => {
    expect(detecterDocumentCv(cv, scene(120, 120, A4))).toBeNull();
  });
});

describe("redresserCv", () => {
  it("redresse la feuille en un rectangle plein de la bonne taille", () => {
    const out = redresserCv(cv, scene(50, 235, A4), A4, 600, 800)!;
    expect(out.width).toBe(600);
    expect(out.height).toBe(800);
    // Les bords de la page redressée sont de la feuille (claire), pas de la table (sombre).
    const lum = (x: number, y: number) => out.data[(y * 600 + x) * 4];
    expect(lum(8, 8)).toBeGreaterThan(200);
    expect(lum(591, 791)).toBeGreaterThan(200);
  });

  it("refuse un quad dégénéré", () => {
    const plat: Quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 5, y: 0 }];
    expect(redresserCv(cv, scene(50, 235, A4), plat, 100, 100)).toBeNull();
  });
});
