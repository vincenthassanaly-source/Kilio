import { describe, expect, it } from "vitest";
import type { ImageDataLike } from "./geometrie";
import { angleDesLignes, redresserLesLignes } from "./redressementTexte";

/** Page de texte (blocs de « mots » en lignes) dont les lignes descendent vers la droite de `deg` degrés. */
function pageTexte(deg: number): ImageDataLike {
  const w = 600, h = 800;
  const t = Math.tan((deg * Math.PI) / 180);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 240;
      const dedans = x > 40 && x < 560 && y > 60 && y < 740;
      const yr = y - x * t;
      const mot = Math.floor(x / 34) % 6 !== 5;
      if (dedans && mot && (((yr % 24) + 24) % 24) < 9) v = 40;
      const i = (y * w + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v - 4; data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe("redressement des lignes de texte", () => {
  it("mesure l'angle de lignes qui descendent vers la droite", () => {
    const angle = angleDesLignes(pageTexte(2));
    expect(angle).not.toBeNull();
    expect(Math.abs(angle! - 2)).toBeLessThan(0.3);
  });

  it("mesure aussi un angle négatif", () => {
    const angle = angleDesLignes(pageTexte(-1.5));
    expect(angle).not.toBeNull();
    expect(Math.abs(angle! + 1.5)).toBeLessThan(0.3);
  });

  it("rend les lignes horizontales après correction", () => {
    // Régression : après le redressement de perspective, le texte restait penché de quelques degrés.
    const avant = pageTexte(2.5);
    const apres = redresserLesLignes(avant);
    expect(apres).not.toBe(avant);
    const reste = angleDesLignes(apres);
    expect(reste === null || Math.abs(reste) < 0.3).toBe(true);
  });

  it("ne touche pas une page déjà droite", () => {
    const droite = pageTexte(0);
    expect(redresserLesLignes(droite)).toBe(droite);
  });

  it("ne touche pas une page à peine inclinée (sous 0,4°)", () => {
    const presque = pageTexte(0.2);
    expect(redresserLesLignes(presque)).toBe(presque);
  });

  it("ne touche pas une page sans texte (dégradé de lumière)", () => {
    const w = 400, h = 500;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = 235 - (x / w) * 40;
        const i = (y * w + x) * 4;
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
    }
    const vide: ImageDataLike = { data, width: w, height: h };
    expect(redresserLesLignes(vide)).toBe(vide);
  });

  it("ne touche pas une grande tache sombre sans lignes (photo)", () => {
    const w = 400, h = 500;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const photo = x > 60 && x < 340 && y > 80 && y < 420;
        const v = photo ? 50 + ((x * 7 + y * 13) % 40) : 238;
        const i = (y * w + x) * 4;
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
    }
    const img: ImageDataLike = { data, width: w, height: h };
    expect(redresserLesLignes(img)).toBe(img);
  });
});
