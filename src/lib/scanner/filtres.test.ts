import { describe, expect, it } from "vitest";
import { appliquerFiltre, couleursFideles, filtreConseille, magicColor, noirEtBlanc, pageSombre } from "./filtres";
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

  it("propose « Noir & blanc » pour une feuille A4, un ticket ou un format carré", () => {
    expect(filtreConseille(1000, 1414)).toBe("noirblanc"); // A4 (1,41) : hors tolérance
    expect(filtreConseille(1414, 1000)).toBe("noirblanc");
    expect(filtreConseille(300, 1000)).toBe("noirblanc"); // ticket
    expect(filtreConseille(800, 800)).toBe("noirblanc");
  });

  it("ne plante pas sur une dimension nulle", () => {
    expect(filtreConseille(0, 0)).toBe("noirblanc");
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

describe("noirEtBlanc", () => {
  // Papier dont l'éclairage passe de 230 à 110 (forte ombre), trait d'encre de 2 px et texte pâle.
  const w = 200;
  const h = 120;
  const eclairage = (x: number) => 230 - (120 * x) / (w - 1);
  const source = image(w, h, (x, y) => {
    const base = eclairage(x);
    if (y >= 59 && y < 61) return [base * 0.12, base * 0.12, base * 0.12]; // encre noire
    if (y >= 30 && y < 32) return [base * 0.62, base * 0.62, base * 0.62]; // crayon pâle
    return [base, base, base * 0.93]; // papier légèrement jauni
  });
  const sortie = noirEtBlanc(source);

  it("rend le papier blanc pur partout, ombre et teinte comprises", () => {
    for (const x of [8, 100, w - 8]) {
      const i = (10 * w + x) * 4;
      expect([sortie.data[i], sortie.data[i + 1], sortie.data[i + 2]]).toEqual([255, 255, 255]);
    }
  });

  it("garde un trait fin d'encre noir, même dans l'ombre", () => {
    expect(lum(sortie, 20, 59)).toBeLessThan(25);
    expect(lum(sortie, w - 20, 59)).toBeLessThan(25);
  });

  it("fonce le crayon pâle pour le rendre lisible, sans l'effacer", () => {
    expect(lum(sortie, 30, 30)).toBeLessThan(120);
    expect(lum(sortie, w - 30, 30)).toBeLessThan(120);
  });

  it("produit uniquement des gris opaques, sans écrêtage de canal", () => {
    for (let i = 0; i < sortie.data.length; i += 4) {
      expect(sortie.data[i]).toBe(sortie.data[i + 1]);
      expect(sortie.data[i]).toBe(sortie.data[i + 2]);
      expect(sortie.data[i + 3]).toBe(255);
    }
  });

  it("ne modifie pas l'image d'entrée", () => {
    const copie = Uint8ClampedArray.from(source.data);
    noirEtBlanc(source);
    expect(Array.from(source.data)).toEqual(Array.from(copie));
  });

  it("garde la même taille", () => {
    expect(sortie.width).toBe(w);
    expect(sortie.height).toBe(h);
  });
});

describe("noirEtBlanc sur support sombre (carte noire, texte clair)", () => {
  // Carte quasi noire, ombre franche sur sa moitié droite, texte blanc fin, léger bruit de capteur.
  const w = 220;
  const h = 130;
  const bruit = (x: number, y: number) => ((x * 7919 + y * 104729) % 11) - 5;
  const carte = image(w, h, (x, y) => {
    const ombre = x > 110 ? 0.45 : 1;
    const texte = y % 26 >= 11 && y % 26 < 14 && x > 20 && x < 200;
    const v = (texte ? 225 : 38) * ombre + bruit(x, y);
    return [v, v, v + 3];
  });
  const sortie = noirEtBlanc(carte);

  it("reconnaît un support sombre, pas une feuille claire", () => {
    expect(pageSombre(carte)).toBe(true);
    expect(pageSombre(image(80, 60, () => [220, 215, 200]))).toBe(false);
  });

  it("garde le fond noir pur, y compris sous l'ombre et malgré le bruit", () => {
    for (const [x, y] of [[10, 5], [60, 40], [150, 5], [200, 120]]) expect(lum(sortie, x, y)).toBeLessThan(8);
  });

  it("garde le texte blanc, dans la lumière comme dans l'ombre", () => {
    expect(lum(sortie, 60, 12)).toBeGreaterThan(215);
    expect(lum(sortie, 160, 12)).toBeGreaterThan(215);
  });
});

describe("appliquerFiltre", () => {
  it("« noirblanc » renvoie une nouvelle image", () => {
    const img = image(10, 10, () => [10, 20, 30]);
    expect(appliquerFiltre(img, "noirblanc")).not.toBe(img);
  });

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
