import { describe, expect, it } from "vitest";
import type { ImageDataLike } from "./geometrie";
import { effacerLesIntrusions } from "./intrusions";

const W = 300;
const H = 400;
const PAPIER = 220;

type Zone = { x0: number; x1: number; y0: number; y1: number; v: number };

/** Page claire avec des lignes de texte fines (2 px, valeur 40) et des zones rectangulaires de valeur `v`. */
function page(zones: Zone[], fond = PAPIER): ImageDataLike {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = fond;
      for (const z of zones) if (x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) v = z.v;
      // Lignes de texte : à partir de x = 90 (la marge gauche reste libre), jamais sur une zone.
      if (x >= 90 && x < 260 && y >= 120 && y < 340 && y % 22 < 2 && v === fond) v = 40;
      const o = (y * W + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

const val = (img: ImageDataLike, x: number, y: number) => img.data[(y * W + x) * 4];

/** Un pixel d'une ligne de texte (y % 22 < 2 dans la zone de texte). */
const TEXTE: [number, number][] = [[100, 132], [180, 154], [240, 330]];

describe("effacerLesIntrusions", () => {
  const bande: Zone = { x0: 0, x1: 20, y0: 0, y1: H, v: 60 };
  const doigt: Zone = { x0: 0, x1: 48, y0: 150, y1: 250, v: 110 };

  it("repeint en blanc une bande de fond sombre et un doigt le long du bord gauche", () => {
    const sortie = effacerLesIntrusions(page([bande, doigt]));
    for (const [x, y] of [[5, 10], [10, 390], [30, 200], [8, 160]]) expect(val(sortie, x, y), `(${x}, ${y})`).toBeGreaterThan(200);
  });

  it("ne touche pas le texte, même près de la zone repeinte", () => {
    const sortie = effacerLesIntrusions(page([bande, doigt]));
    for (const [x, y] of TEXTE) expect(val(sortie, x, y), `texte (${x}, ${y})`).toBeLessThan(80);
  });

  it("ne touche pas un petit bloc sombre au bord (un code QR coupé par le bord de la page)", () => {
    const qr: Zone = { x0: 140, x1: 154, y0: H - 14, y1: H, v: 20 };
    const sortie = effacerLesIntrusions(page([qr]));
    expect(val(sortie, 146, H - 7)).toBeLessThan(40);
  });

  it("ne touche pas l'ombre du papier qui s'étend loin dans la page", () => {
    // Ombre à 73 % du papier sur tout le bas de la page, texte compris : ce n'est pas une intrusion.
    const ombre: Zone = { x0: 0, x1: W, y0: 260, y1: H, v: 160 };
    const source = page([ombre]);
    const sortie = effacerLesIntrusions(source);
    expect(sortie).toBe(source);
    expect(val(sortie, 150, 300)).toBe(160);
  });

  it("repeint un fin trait sombre plat tout en haut de la page", () => {
    const trait: Zone = { x0: 100, x1: 180, y0: 3, y1: 5, v: 20 };
    const sortie = effacerLesIntrusions(page([trait]));
    expect(val(sortie, 140, 4)).toBeGreaterThan(200);
  });

  it("garde la même image (sans copie) quand il n'y a rien à nettoyer", () => {
    const propre = page([]);
    expect(effacerLesIntrusions(propre)).toBe(propre);
  });

  it("ne nettoie pas une page sombre (carte, photo)", () => {
    const carte = page([], 90);
    expect(effacerLesIntrusions(carte)).toBe(carte);
  });

  it("ne modifie pas l'image d'entrée", () => {
    const source = page([bande, doigt]);
    const copie = new Uint8ClampedArray(source.data);
    effacerLesIntrusions(source);
    expect(source.data).toEqual(copie);
  });
});
