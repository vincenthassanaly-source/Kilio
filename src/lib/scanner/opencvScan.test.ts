// @vitest-environment node
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import type { ImageDataLike, Quad } from "./geometrie";
import type { Cv } from "./opencv";
import { consensusQuads, detecterDocumentCv, detecterDocumentRobuste, medianeQuads, redresserCv } from "./opencvScan";
import { detecterFeuille } from "./detection";

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

describe("medianeQuads", () => {
  const rect = (x0: number, y0: number, x1: number, y1: number): Quad => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

  it("écarte un cadre tronqué parmi des cadres cohérents", () => {
    const m = medianeQuads([rect(100, 100, 500, 300), rect(102, 98, 498, 302), rect(100, 100, 500, 215), rect(98, 101, 501, 299)]);
    expect(m[2].y).toBeGreaterThan(295);
    expect(m[2].y).toBeLessThan(305);
  });

  it("rend le cadre lui-même quand il est seul", () => {
    expect(medianeQuads([rect(1, 2, 30, 40)])).toEqual(rect(1, 2, 30, 40));
  });
});

describe("consensusQuads", () => {
  const rect = (x0: number, y0: number, x1: number, y1: number): Quad => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const DIAG = 1000;

  it("retient le groupe le plus nombreux et ignore l'aberrant", () => {
    const q = consensusQuads([rect(100, 100, 500, 300), rect(102, 99, 499, 301), rect(100, 100, 500, 140), rect(101, 100, 501, 299)], DIAG)!;
    expect(q[2].y).toBeGreaterThan(295);
  });

  it("à égalité, préfère le cadre le plus grand (le tronqué est plus petit)", () => {
    const q = consensusQuads([rect(100, 100, 500, 215), rect(100, 100, 500, 300)], DIAG)!;
    expect(q[2].y).toBe(300);
  });

  it("rend null sans aucun cadre", () => {
    expect(consensusQuads([], DIAG)).toBeNull();
  });
});

describe("detecterDocumentRobuste : carte noire sur parquet, avec ombre franche et bruit", () => {
  // Cas réel remonté par l'utilisateur : carte noire à texte blanc, posée en biais sur un parquet
  // à veines, une ombre portée traversant la scène. La détection à une seule échelle échouait ou
  // tronquait selon la taille d'analyse.
  const GW = 1600;
  const GH = 1200;
  const CARTE: Quad = [{ x: 560, y: 380 }, { x: 1010, y: 300 }, { x: 1130, y: 760 }, { x: 640, y: 880 }];

  function parquet(): ImageDataLike {
    const data = new Uint8ClampedArray(GW * GH * 4);
    let graine = 12345;
    const alea = () => ((graine = (graine * 1664525 + 1013904223) >>> 0) / 4294967296) - 0.5;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const veine = 14 * Math.sin((x * 0.9 + y * 0.35) / 7) + 9 * Math.sin((x * 0.2 - y * 0.8) / 13) + 6 * Math.sin(y / 3.1);
        const lame = (Math.floor((x + y * 0.4) / 330) % 2) * 12; // lames de parquet de teintes alternées
        const ombre = x * 0.6 - y * 0.8 > -150 ? 1 : 0.4; // ombre franche en diagonale
        const o = (y * GW + x) * 4;
        const n = alea() * 10;
        data[o] = (150 + veine + lame + n) * ombre;
        data[o + 1] = (112 + veine * 0.8 + lame + n) * ombre;
        data[o + 2] = (80 + veine * 0.6 + lame + n) * ombre;
        data[o + 3] = 255;
      }
    }
    // Carte noire (polygone) + lignes de texte blanc, bruit de capteur.
    const img = new cv.Mat(GH, GW, cv.CV_8UC4);
    img.data.set(data);
    const pts = cv.matFromArray(4, 1, cv.CV_32SC2, CARTE.flatMap((p) => [p.x, p.y]));
    const mv = new cv.MatVector();
    mv.push_back(pts);
    cv.fillPoly(img, mv, new cv.Scalar(28, 28, 32, 255));
    const [a, b, , d] = CARTE;
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      const p1 = { x: a.x + (d.x - a.x) * t + (b.x - a.x) * 0.12, y: a.y + (d.y - a.y) * t + (b.y - a.y) * 0.12 };
      const p2 = { x: p1.x + (b.x - a.x) * 0.7, y: p1.y + (b.y - a.y) * 0.7 };
      cv.line(img, new cv.Point(p1.x, p1.y), new cv.Point(p2.x, p2.y), new cv.Scalar(225, 225, 225, 255), 3);
    }
    const sortie = { data: new Uint8ClampedArray(img.data), width: GW, height: GH };
    [img, pts, mv].forEach((m) => m.delete());
    return sortie;
  }

  it("retrouve la carte entière à moins de 3 % de la diagonale", async () => {
    const scene = parquet();
    const vieux = detecterFeuille(scene);
    const q = await detecterDocumentRobuste(cv, scene, { supplementaires: vieux ? [vieux] : [], ceder: async () => {} });
    expect(q, "aucun cadre").not.toBeNull();
    const diag = Math.hypot(GW, GH);
    expect(erreurMax(q!, CARTE) / diag).toBeLessThan(0.03);
  }, 60_000);

  it("rend la main à l'interface entre deux échelles", async () => {
    let appels = 0;
    await detecterDocumentRobuste(cv, parquet(), {
      echelles: [600, 900],
      ceder: async () => {
        appels++;
      },
    });
    expect(appels).toBe(2);
  }, 60_000);
});
