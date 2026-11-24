import { describe, expect, it } from "vitest";
import {
  aireQuad,
  bornerQuad,
  ordonnerCoins,
  quadParDefaut,
  quadValide,
  redresser,
  tailleSortie,
  type ImageDataLike,
  type Quad,
} from "./geometrie";

function image(w: number, h: number, couleur: (x: number, y: number) => [number, number, number]): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = couleur(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe("ordonnerCoins", () => {
  it("remet des points mélangés dans l'ordre HG, HD, BD, BG", () => {
    const quad = ordonnerCoins([
      { x: 90, y: 100 },
      { x: 10, y: 12 },
      { x: 12, y: 98 },
      { x: 95, y: 8 },
    ]);
    expect(quad).toEqual([
      { x: 10, y: 12 },
      { x: 95, y: 8 },
      { x: 90, y: 100 },
      { x: 12, y: 98 },
    ]);
  });

  it("refuse un nombre de points différent de 4", () => {
    expect(() => ordonnerCoins([{ x: 0, y: 0 }])).toThrow();
  });

  it("garde 4 coins distincts, dans le sens horaire, pour un carré tourné de 0 à 90° par pas de 5°", () => {
    // Régression : le tri par x+y et x−y sortait deux fois le même point à 45° pile.
    for (let deg = 0; deg <= 90; deg += 5) {
      const a = (deg * Math.PI) / 180;
      const coins = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => ({
        x: 200 + 100 * (dx * Math.cos(a) - dy * Math.sin(a)),
        y: 150 + 100 * (dx * Math.sin(a) + dy * Math.cos(a)),
      }));
      const quad = ordonnerCoins([coins[2], coins[0], coins[3], coins[1]]);
      const distincts = new Set(quad.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`));
      expect(distincts.size, `${deg}°`).toBe(4);
      expect(quadValide(quad), `${deg}° : convexe et dans l'ordre`).toBe(true);
      // Sens horaire à l'écran (y vers le bas) : aire signée positive.
      let aire = 0;
      for (let i = 0; i < 4; i++) aire += quad[i].x * quad[(i + 1) % 4].y - quad[(i + 1) % 4].x * quad[i].y;
      expect(aire, `${deg}° : sens horaire`).toBeGreaterThan(0);
      // Le premier coin est celui qui minimise x+y.
      expect(quad[0].x + quad[0].y, `${deg}° : départ en haut à gauche`).toBeCloseTo(Math.min(...coins.map((p) => p.x + p.y)), 6);
    }
  });
});

describe("quadValide / aireQuad", () => {
  const carre: Quad = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("accepte un carré et calcule son aire", () => {
    expect(quadValide(carre)).toBe(true);
    expect(aireQuad(carre)).toBe(100);
  });

  it("rejette un quadrilatère croisé (« papillon »)", () => {
    const croise: Quad = [carre[0], carre[2], carre[1], carre[3]];
    expect(quadValide(croise)).toBe(false);
  });

  it("rejette un quadrilatère aplati", () => {
    const plat: Quad = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(quadValide(plat)).toBe(false);
  });
});

describe("quadParDefaut / bornerQuad", () => {
  it("laisse une marge autour de l'image", () => {
    const [hg, , bd] = quadParDefaut(100, 200, 0.1);
    expect(hg).toEqual({ x: 10, y: 20 });
    expect(bd).toEqual({ x: 90, y: 180 });
  });

  it("ramène les coins dans l'image", () => {
    const quad = bornerQuad(
      [
        { x: -5, y: -5 },
        { x: 120, y: 3 },
        { x: 130, y: 210 },
        { x: 4, y: 250 },
      ],
      100,
      200
    );
    expect(quad).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 3 },
      { x: 100, y: 200 },
      { x: 4, y: 200 },
    ]);
  });
});

describe("tailleSortie", () => {
  it("prend les plus grands côtés opposés", () => {
    const t = tailleSortie([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 110, y: 150 },
      { x: 0, y: 140 },
    ]);
    // Largeur : max(100, 110) ; hauteur : max(140, hypot(10, 150)).
    expect(t.largeur).toBe(110);
    expect(t.hauteur).toBe(Math.round(Math.hypot(10, 150)));
  });

  it("borne le plus grand côté", () => {
    const t = tailleSortie(
      [
        { x: 0, y: 0 },
        { x: 8000, y: 0 },
        { x: 8000, y: 4000 },
        { x: 0, y: 4000 },
      ],
      2000
    );
    expect(t).toEqual({ largeur: 2000, hauteur: 1000 });
  });
});

describe("redresser", () => {
  it("extrait un rectangle axé sur l'image sans le déformer", () => {
    // Fond noir, rectangle rouge de (20,10) à (60,50).
    const src = image(80, 60, (x, y) => (x >= 20 && x < 60 && y >= 10 && y < 50 ? [255, 0, 0] : [0, 0, 0]));
    const quad: Quad = [
      { x: 20, y: 10 },
      { x: 60, y: 10 },
      { x: 60, y: 50 },
      { x: 20, y: 50 },
    ];
    const sortie = redresser(src, quad, 40, 40)!;
    expect(sortie.width).toBe(40);
    expect(sortie.height).toBe(40);
    for (const [x, y] of [[1, 1], [20, 20], [38, 38], [1, 38]]) {
      const i = (y * 40 + x) * 4;
      expect([sortie.data[i], sortie.data[i + 1], sortie.data[i + 2]]).toEqual([255, 0, 0]);
    }
  });

  it("redresse une feuille en perspective : le coin haut-gauche reste en haut à gauche", () => {
    // Fond gris ; feuille trapézoïdale dont le coin HG porte un repère vert.
    const src = image(100, 100, () => [90, 90, 90]);
    const quad: Quad = [
      { x: 20, y: 20 },
      { x: 80, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 80 },
    ];
    for (let y = 20; y < 24; y++) {
      for (let x = 20; x < 24; x++) {
        const i = (y * 100 + x) * 4;
        src.data[i] = 0;
        src.data[i + 1] = 255;
        src.data[i + 2] = 0;
      }
    }
    const sortie = redresser(src, quad, 60, 60)!;
    const i = (1 * 60 + 1) * 4;
    expect(sortie.data[i + 1]).toBeGreaterThan(200);
    expect(sortie.data[i]).toBeLessThan(80);
  });

  it("renvoie null pour un quadrilatère dégénéré", () => {
    const src = image(10, 10, () => [0, 0, 0]);
    const plat: Quad = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(redresser(src, plat, 10, 10)).toBeNull();
  });
});
