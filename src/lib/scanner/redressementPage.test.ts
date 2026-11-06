import { describe, expect, it } from "vitest";
import type { ImageDataLike } from "./geometrie";
import { redresserParTranches } from "./redressementPage";
import { estimerAngle } from "./redressementTexte";

const W = 600, H = 800;
const NB_LIGNES = 23;

/**
 * Page de texte (blocs de « mots » en lignes) dont les lignes penchent d'un angle qui varie avec la hauteur
 * (`bosse` : angle maximal en degrés, autour de y = 300 ; `angleBase` : angle de toutes les lignes) et dont
 * la marge gauche penche (`pente` : pixels de marge gagnés par pixel de hauteur).
 */
function page({ bosse = 0, angleBase = 0, pente = 0 }: { bosse?: number; angleBase?: number; pente?: number }): ImageDataLike {
  const lignes = Array.from({ length: NB_LIGNES }, (_, i) => {
    const y = 70 + 31 * i;
    const deg = angleBase + bosse * Math.exp(-(((y - 300) / 150) ** 2));
    return { y, t: Math.tan((deg * Math.PI) / 180), gauche: 70 + pente * y };
  });
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 240;
      for (const l of lignes) {
        const dx = x - l.gauche;
        if (dx >= 0 && dx < 500 && dx % 50 < 36 && Math.abs(y - (l.y + (x - W / 2) * l.t)) < 5) {
          v = 40;
          break;
        }
      }
      const i = (y * W + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v - 4; data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

/** Angle des lignes dans chaque bande (6 bandes de haut en bas) ; null si non mesurable. */
function anglesParBande(img: ImageDataLike, bandes = 6): (number | null)[] {
  const h = Math.floor(img.height / bandes);
  return Array.from({ length: bandes }, (_, b) => {
    const data = new Uint8ClampedArray(img.data.slice(b * h * img.width * 4, (b + 1) * h * img.width * 4));
    return estimerAngle({ data, width: img.width, height: h })?.deg ?? null;
  });
}

const pireEcart = (angles: (number | null)[]) => Math.max(...angles.filter((a): a is number => a !== null).map(Math.abs));

describe("redressement local d'une page de texte", () => {
  it("redresse un éventail de lignes et une marge qui penche (papier courbé)", () => {
    // Régression : lignes à +2,5° dans le tiers haut et droites en bas, marge qui penche de ~2° : une
    // rotation globale ou une perspective simple ne corrige pas cela ; CamScanner, si.
    const avant = page({ bosse: 2.5, pente: 0.035 });
    const apres = redresserParTranches(avant);
    expect(apres).not.toBe(avant);
    expect(pireEcart(anglesParBande(avant))).toBeGreaterThan(1.5);
    expect(pireEcart(anglesParBande(apres))).toBeLessThan(0.6);
  });

  it("garde le texte intact : même nombre de pixels d'encre à 15 % près", () => {
    const avant = page({ bosse: 2.5, pente: 0.035 });
    const apres = redresserParTranches(avant);
    const encre = (img: ImageDataLike) => {
      let n = 0;
      for (let i = 0; i < img.data.length; i += 4) if (img.data[i] < 120) n++;
      return n;
    };
    expect(Math.abs(encre(apres) - encre(avant)) / encre(avant)).toBeLessThan(0.15);
  });

  it("ne touche pas une page déjà droite", () => {
    const droite = page({});
    expect(redresserParTranches(droite)).toBe(droite);
  });

  it("laisse à la rotation globale une page simplement tournée (lignes et marge penchent pareil)", () => {
    // Éviter de corriger deux fois : une rotation de 2° incline lignes ET marge de la même façon.
    const tournee = page({ angleBase: 2, pente: Math.tan((2 * Math.PI) / 180) });
    expect(redresserParTranches(tournee)).toBe(tournee);
  });

  it("ne touche pas une page sans texte", () => {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = 235 - (x / W) * 40;
        const i = (y * W + x) * 4;
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
    }
    const vide: ImageDataLike = { data, width: W, height: H };
    expect(redresserParTranches(vide)).toBe(vide);
  });

  it("ne touche pas une grande tache sombre sans lignes (photo)", () => {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const photo = x > 80 && x < 520 && y > 100 && y < 700;
        const v = photo ? 50 + ((x * 7 + y * 13) % 40) : 238;
        const i = (y * W + x) * 4;
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
    }
    const img: ImageDataLike = { data, width: W, height: H };
    expect(redresserParTranches(img)).toBe(img);
  });
});
