import { describe, expect, it } from "vitest";
import { detecterQuadrilatere, reduirePourDetection } from "./detection";
import type { ImageDataLike } from "./geometrie";

function scene(
  w: number,
  h: number,
  estPapier: (x: number, y: number) => boolean,
  papier = 235,
  fond = 50
): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = estPapier(x, y) ? papier : fond;
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe("detecterQuadrilatere", () => {
  it("retrouve les coins d'un rectangle clair sur fond sombre", () => {
    const img = scene(200, 160, (x, y) => x >= 40 && x < 160 && y >= 30 && y < 130);
    const quad = detecterQuadrilatere(img)!;
    expect(quad).not.toBeNull();
    const [hg, hd, bd, bg] = quad;
    expect(hg.x).toBeCloseTo(40, -1);
    expect(hg.y).toBeCloseTo(30, -1);
    expect(hd.x).toBeCloseTo(160, -1);
    expect(hd.y).toBeCloseTo(30, -1);
    expect(bd.x).toBeCloseTo(160, -1);
    expect(bd.y).toBeCloseTo(130, -1);
    expect(bg.x).toBeCloseTo(40, -1);
    expect(bg.y).toBeCloseTo(130, -1);
  });

  it("retrouve une feuille légèrement en perspective (trapèze)", () => {
    // Trapèze : haut plus étroit que le bas.
    const img = scene(240, 200, (x, y) => {
      if (y < 20 || y >= 180) return false;
      const t = (y - 20) / 160;
      const gauche = 70 - 40 * t;
      const droite = 170 + 40 * t;
      return x >= gauche && x <= droite;
    });
    const quad = detecterQuadrilatere(img)!;
    expect(quad).not.toBeNull();
    const [hg, hd, bd, bg] = quad;
    expect(hd.x - hg.x).toBeLessThan(bd.x - bg.x);
    expect(hg.y).toBeLessThan(bg.y);
  });

  it("renvoie null sur une image uniforme", () => {
    const img = scene(100, 100, () => false);
    expect(detecterQuadrilatere(img)).toBeNull();
  });

  it("renvoie null si la zone claire est minuscule", () => {
    const img = scene(200, 200, (x, y) => x >= 90 && x < 100 && y >= 90 && y < 100);
    expect(detecterQuadrilatere(img)).toBeNull();
  });
});

describe("reduirePourDetection", () => {
  it("laisse intacte une image déjà petite", () => {
    const img = scene(100, 80, () => true);
    const { image, facteur } = reduirePourDetection(img, 240);
    expect(image).toBe(img);
    expect(facteur).toBe(1);
  });

  it("réduit au côté maximal et renvoie le facteur d'agrandissement", () => {
    const img = scene(1000, 500, () => true);
    const { image, facteur } = reduirePourDetection(img, 250);
    expect(image.width).toBe(250);
    expect(image.height).toBe(125);
    expect(facteur).toBeCloseTo(4);
  });
});
