import { describe, expect, it } from "vitest";
import { etendreAuxBordsDeLaFeuille } from "./extension";
import type { ImageDataLike, Quad } from "./geometrie";
import { erreurCoins, sceneLimite, scenesDeReference } from "./scenes";

type Rvb = [number, number, number];

/** Photo d'une page qui déborde presque du cadre : un peu de tissu jaune sur les côtés, du texte au milieu. */
function pagePleinCadre(): { image: ImageDataLike; verite: Quad } {
  const w = 300, h = 400;
  const data = new Uint8ClampedArray(w * h * 4);
  const gauche = 10, droite = 288;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c: Rvb = [236, 238, 242]; // papier légèrement bleuté
      if (x < gauche || x > droite) c = [196, 150, 62]; // tissu jaune
      else if (y % 20 > 13 && x > 50 && x < 250 && y > 90 && y < 320) c = [38, 40, 48]; // lignes de texte
      const i = (y * w + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return {
    image: { data, width: w, height: h },
    verite: [{ x: gauche, y: 0 }, { x: droite, y: 0 }, { x: droite, y: h - 1 }, { x: gauche, y: h - 1 }],
  };
}

describe("extension du cadre jusqu'au bord de la feuille", () => {
  it("étend un cadre accroché au bloc de texte jusqu'aux vrais bords de la page", () => {
    // Régression : sur une page qui déborde du cadre, le détecteur renvoyait le bloc de texte.
    const { image, verite } = pagePleinCadre();
    const interieur: Quad = [{ x: 50, y: 90 }, { x: 250, y: 90 }, { x: 250, y: 320 }, { x: 50, y: 320 }];
    const etendu = etendreAuxBordsDeLaFeuille(image, interieur);
    expect(erreurCoins(etendu, verite, image.width, image.height)).toBeLessThan(0.02);
  });

  it("ne dépasse pas la page quand le fond est derrière (les côtés s'arrêtent sur le tissu)", () => {
    const { image } = pagePleinCadre();
    const interieur: Quad = [{ x: 50, y: 90 }, { x: 250, y: 90 }, { x: 250, y: 320 }, { x: 50, y: 320 }];
    const etendu = etendreAuxBordsDeLaFeuille(image, interieur);
    for (const p of etendu) {
      expect(p.x, "ne doit pas déborder sur le tissu à gauche").toBeGreaterThanOrEqual(8);
      expect(p.x, "ne doit pas déborder sur le tissu à droite").toBeLessThanOrEqual(290);
    }
  });

  it("laisse un cadre déjà posé sur le vrai bord là où il est", () => {
    const { image, verite } = pagePleinCadre();
    const etendu = etendreAuxBordsDeLaFeuille(image, verite);
    expect(erreurCoins(etendu, verite, image.width, image.height)).toBeLessThan(0.01);
  });

  for (const scene of [...scenesDeReference(), sceneLimite()]) {
    it(`ne déplace pas un cadre juste : ${scene.nom}`, () => {
      const etendu = etendreAuxBordsDeLaFeuille(scene.image, scene.verite);
      expect(erreurCoins(etendu, scene.verite, scene.image.width, scene.image.height)).toBeLessThan(0.02);
    });
  }
});
