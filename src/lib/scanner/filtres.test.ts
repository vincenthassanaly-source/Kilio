import { describe, expect, it } from "vitest";
import { appliquerFiltre, couleursFideles, filtreConseille, magicColor } from "./filtres";
import type { ImageDataLike } from "./geometrie";

function image(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const lum = (img: ImageDataLike, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
};

describe("magicColor", () => {
  // Papier dont l'éclairage passe de 230 (gauche) à 120 (droite : ombre),
  // avec une ligne d'encre noire horizontale épaisse au milieu.
  const w = 160;
  const h = 120;
  const eclairage = (x: number) => 230 - (110 * x) / (w - 1);
  const encre = (y: number) => y >= 58 && y < 62;
  const source = image(w, h, (x, y) => {
    const v = encre(y) ? 20 : eclairage(x);
    return [v, v, v];
  });

  it("rend le papier blanc, même dans l'ombre", () => {
    const sortie = magicColor(source);
    expect(lum(sortie, 10, 10)).toBeGreaterThan(235);
    expect(lum(sortie, w - 10, 10)).toBeGreaterThan(235);
  });

  it("garde l'encre sombre", () => {
    const sortie = magicColor(source);
    expect(lum(sortie, w / 2, 60)).toBeLessThan(60);
  });

  it("uniformise un papier coloré uniforme", () => {
    const jaune = image(40, 40, () => [240, 230, 150]);
    const sortie = magicColor(jaune);
    // Fond uniforme → le rapport vaut 1 → blanc sur les trois canaux.
    expect(lum(sortie, 20, 20)).toBeGreaterThan(235);
  });

  it("ne modifie pas l'image d'entrée et conserve ses dimensions", () => {
    const copie = new Uint8ClampedArray(source.data);
    const sortie = magicColor(source);
    expect(source.data).toEqual(copie);
    expect(sortie.width).toBe(w);
    expect(sortie.height).toBe(h);
    expect(sortie.data.length).toBe(source.data.length);
  });
});

describe("filtreConseille", () => {
  it("propose « Couleurs fidèles » pour une carte, dans les deux orientations", () => {
    expect(filtreConseille(856, 540)).toBe("couleurs");
    expect(filtreConseille(540, 856)).toBe("couleurs");
    expect(filtreConseille(320, 202)).toBe("couleurs");
  });

  it("propose « Magic color » pour une feuille A4, un ticket ou un format carré", () => {
    expect(filtreConseille(1000, 1414)).toBe("magic"); // A4 (1,41) : hors tolérance
    expect(filtreConseille(1414, 1000)).toBe("magic");
    expect(filtreConseille(300, 1000)).toBe("magic"); // ticket
    expect(filtreConseille(800, 800)).toBe("magic");
  });

  it("ne plante pas sur une dimension nulle", () => {
    expect(filtreConseille(0, 0)).toBe("magic");
  });
});

describe("couleursFideles", () => {
  it("ne modifie pas l'image d'entrée et conserve ses dimensions", () => {
    const img = image(40, 30, (x) => [100 + x, 120, 140]);
    const copie = new Uint8ClampedArray(img.data);
    const sortie = couleursFideles(img);
    expect(img.data).toEqual(copie);
    expect(sortie.width).toBe(40);
    expect(sortie.height).toBe(30);
    expect(sortie.data.length).toBe(img.data.length);
  });
});

describe("appliquerFiltre", () => {
  it("« original » renvoie la même image", () => {
    const img = image(10, 10, () => [10, 20, 30]);
    expect(appliquerFiltre(img, "original")).toBe(img);
  });

  it("« couleurs » renvoie une nouvelle image", () => {
    const img = image(10, 10, () => [10, 20, 30]);
    expect(appliquerFiltre(img, "couleurs")).not.toBe(img);
  });

  it("« magic » renvoie une nouvelle image", () => {
    const img = image(10, 10, () => [10, 20, 30]);
    expect(appliquerFiltre(img, "magic")).not.toBe(img);
  });
});
