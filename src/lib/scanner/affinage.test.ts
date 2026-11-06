import { describe, expect, it } from "vitest";
import { affinerLesCotes } from "./affinage";
import type { ImageDataLike, Point, Quad } from "./geometrie";
import { erreurCoins, sceneLimite, scenesDeReference } from "./scenes";

type Rvb = [number, number, number];

function dansConvexe(quad: Point[], x: number, y: number): boolean {
  let signe = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (c === 0) continue;
    if (signe === 0) signe = Math.sign(c);
    else if (Math.sign(c) !== signe) return false;
  }
  return true;
}

/** Page légèrement de travers (bords non verticaux) sur du tissu jaune, avec des lignes de texte à l'intérieur. */
function pageDeTravers(): { image: ImageDataLike; verite: Quad } {
  const w = 400, h = 500;
  const verite: Quad = [{ x: 30, y: 20 }, { x: 370, y: 28 }, { x: 362, y: 480 }, { x: 22, y: 470 }];
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c: Rvb = [196, 150, 62]; // tissu
      if (dansConvexe(verite, x, y)) {
        c = [236, 238, 242]; // papier
        if (y % 22 > 15 && x > 70 && x < 330 && y > 80 && y < 420) c = [38, 40, 48]; // texte
      }
      const i = (y * w + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { image: { data, width: w, height: h }, verite };
}

describe("recalage des côtés du cadre sur le vrai bord", () => {
  it("redresse un cadre dont les côtés n'ont pas la bonne inclinaison", () => {
    // Régression : l'extension gardait l'inclinaison d'un pli ou d'un bloc de texte, d'où des bords
    // non parallèles et du fond visible après redressement.
    const { image, verite } = pageDeTravers();
    const approximatif: Quad = [{ x: 30, y: 20 }, { x: 370, y: 28 }, { x: 378, y: 480 }, { x: 8, y: 470 }];
    const avant = erreurCoins(approximatif, verite, image.width, image.height);
    const affine = affinerLesCotes(image, approximatif);
    const apres = erreurCoins(affine, verite, image.width, image.height);
    expect(avant, "le cadre de départ doit être nettement faux pour que le test ait un sens").toBeGreaterThan(0.015);
    expect(apres).toBeLessThan(0.008);
  });

  it("laisse un cadre déjà posé sur le vrai bord là où il est", () => {
    const { image, verite } = pageDeTravers();
    const affine = affinerLesCotes(image, verite);
    expect(erreurCoins(affine, verite, image.width, image.height)).toBeLessThan(0.006);
  });

  it("ne bouge pas un cadre dont les côtés sont sur le bord de la photo (page qui déborde)", () => {
    const w = 300, h = 400;
    const data = new Uint8ClampedArray(w * h * 4).fill(238);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    const image: ImageDataLike = { data, width: w, height: h };
    const plein: Quad = [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }];
    const affine = affinerLesCotes(image, plein);
    expect(erreurCoins(affine, plein, w, h)).toBeLessThan(0.005);
  });

  it("pose sur le bord de la photo un côté où la page continue jusqu'au cadre (page coupée par la photo)", () => {
    // Régression : sur une page coupée par la photo, le cadre recoupait le texte avec un côté incliné ;
    // CamScanner garde tout ce qui est visible, jusqu'au bord de la photo.
    const w = 400, h = 500;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tissu = x > 360 && y < 70; // seul un petit coin de fond en haut à droite
        const c: Rvb = tissu ? [196, 150, 62] : [236, 238, 242];
        const i = (y * w + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }
    const image: ImageDataLike = { data, width: w, height: h };
    // Cadre trouvé à l'intérieur de la page, bien en retrait du bord de la photo.
    const interieur: Quad = [{ x: 20, y: 20 }, { x: 350, y: 20 }, { x: 350, y: 480 }, { x: 20, y: 480 }];
    const affine = affinerLesCotes(image, interieur);
    const photoEntiere: Quad = [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }];
    expect(erreurCoins(interieur, photoEntiere, w, h), "le cadre de départ doit être nettement en retrait").toBeGreaterThan(0.04);
    expect(erreurCoins(affine, photoEntiere, w, h)).toBeLessThan(0.02);
  });

  for (const scene of [...scenesDeReference(), sceneLimite()]) {
    it(`ne déplace pas un cadre juste : ${scene.nom}`, () => {
      const affine = affinerLesCotes(scene.image, scene.verite);
      expect(erreurCoins(affine, scene.verite, scene.image.width, scene.image.height)).toBeLessThan(0.02);
    });
  }
});
