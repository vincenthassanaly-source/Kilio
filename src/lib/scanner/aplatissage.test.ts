import { describe, expect, it } from "vitest";
import { aplatirLesLignes } from "./aplatissage";
import type { ImageDataLike } from "./geometrie";

const W = 400;
const H = 500;
const PAPIER = 225;
const ENCRE = 35;

/**
 * Page de lignes de « texte » : barres de 3 px coupées par de petits trous (les mots). `decalage(x, k)`
 * déplace verticalement la ligne k à la colonne x (papier courbé ou plié).
 */
function page(nbLignes: number, decalage: (x: number, k: number) => number): ImageDataLike {
  const data = new Uint8ClampedArray(W * H * 4).fill(PAPIER);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (let k = 0; k < nbLignes; k++) {
    const y0 = 60 + k * 45;
    for (let x = 40; x < W - 40; x++) {
      if (x % 40 >= 35) continue; // trou entre deux mots
      const y = Math.round(y0 + decalage(x, k));
      for (let dy = 0; dy < 3; dy++) {
        const o = ((y + dy) * W + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = ENCRE;
      }
    }
  }
  return { data, width: W, height: H };
}

/** Hauteur moyenne de l'encre de la ligne k, entre les colonnes x0 et x1 (fenêtre de ±25 px autour de la ligne). */
function centre(img: ImageDataLike, k: number, x0: number, x1: number): number {
  const y0 = 60 + k * 45;
  let somme = 0, n = 0;
  for (let y = y0 - 25; y < y0 + 25; y++) {
    for (let x = x0; x < x1; x++) {
      if (img.data[(y * W + x) * 4] < 100) { somme += y; n++; }
    }
  }
  return somme / n;
}

/** Écart entre la hauteur de la ligne à gauche, au milieu et à droite : 0 = parfaitement horizontale. */
const ecart = (img: ImageDataLike, k: number) => {
  const a = centre(img, k, 50, 110);
  const b = centre(img, k, 170, 230);
  const c = centre(img, k, 290, 350);
  return Math.max(Math.abs(a - b), Math.abs(c - b));
};

describe("aplatirLesLignes", () => {
  // Papier plié en V au centre : les lignes montent de 14 px puis redescendent.
  const pli = (x: number) => -14 * (1 - Math.abs(x - W / 2) / (W / 2));
  const pliee = page(8, pli);

  it("aplatit des lignes pliées en V : l'écart de hauteur d'une ligne diminue d'au moins 60 %", () => {
    const sortie = aplatirLesLignes(pliee);
    expect(sortie).not.toBe(pliee);
    for (const k of [1, 3, 6]) expect(ecart(sortie, k)).toBeLessThan(0.4 * ecart(pliee, k));
  });

  it("garde l'image d'entrée intacte et les mêmes dimensions", () => {
    const copie = new Uint8ClampedArray(pliee.data);
    const sortie = aplatirLesLignes(pliee);
    expect(pliee.data).toEqual(copie);
    expect(sortie.width).toBe(W);
    expect(sortie.height).toBe(H);
  });

  it("ne touche pas des lignes droites", () => {
    const droite = page(8, () => 0);
    expect(aplatirLesLignes(droite)).toBe(droite);
  });

  it("ne touche pas des lignes seulement inclinées (la rotation globale s'en charge)", () => {
    const inclinee = page(8, (x) => (x - W / 2) * 0.03);
    expect(aplatirLesLignes(inclinee)).toBe(inclinee);
  });

  it("ne touche pas une page avec trop peu de lignes", () => {
    const peu = page(2, pli);
    expect(aplatirLesLignes(peu)).toBe(peu);
  });

  it("ne touche pas une page sans texte", () => {
    const vide = page(0, () => 0);
    expect(aplatirLesLignes(vide)).toBe(vide);
  });
});
