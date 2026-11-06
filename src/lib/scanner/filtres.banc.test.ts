// Banc d'essai des filtres, sur des critères objectifs : teinte conservée,
// papier neutre, ombre atténuée, grandes zones sombres non aplaties.
import { describe, expect, it } from "vitest";
import { couleursFideles, magicColor, noirEtBlanc } from "./filtres";
import { redresser, tailleSortie, type ImageDataLike } from "./geometrie";
import { scenesDeReference } from "./scenes";

type Rvb = [number, number, number];

function pixel(img: ImageDataLike, x: number, y: number): Rvb {
  const i = (Math.round(y) * img.width + Math.round(x)) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

/** Moyenne d'un rectangle (fractions 0-1 de l'image). */
function moyenne(img: ImageDataLike, x0: number, y0: number, x1: number, y1: number): Rvb {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(y0 * img.height); y < Math.floor(y1 * img.height); y++) {
    for (let x = Math.floor(x0 * img.width); x < Math.floor(x1 * img.width); x++) {
      const p = pixel(img, x, y);
      r += p[0]; g += p[1]; b += p[2]; n++;
    }
  }
  return [r / n, g / n, b / n];
}

const lum = (c: Rvb) => (77 * c[0] + 150 * c[1] + 29 * c[2]) / 256;
/** Teinte en degrés (0-360). */
const teinte = (c: Rvb) => ((Math.atan2(Math.sqrt(3) * (c[1] - c[2]), 2 * c[0] - c[1] - c[2]) * 180) / Math.PI + 360) % 360;
const ecartTeinte = (a: Rvb, b: Rvb) => {
  const d = Math.abs(teinte(a) - teinte(b));
  return Math.min(d, 360 - d);
};
const saturation = (c: Rvb) => Math.max(...c) - Math.min(...c);

/** Page de texte sur papier jauni, ombre qui assombrit la droite, avec un logo rouge. */
function pageJaunieAvecOmbre(): ImageDataLike {
  const w = 240, h = 180;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c: Rvb = [238, 230, 205]; // papier jauni
      if (y % 22 > 15 && x > 20 && x < 170 && y > 70) c = [40, 38, 44]; // lignes de texte (dont y = 84)
      if (x > 30 && x < 70 && y > 20 && y < 50) c = [200, 40, 40]; // logo rouge
      const ombre = 1 - 0.45 * Math.min(1, Math.max(0, (x - 110) / 70)); // ombre à droite
      const i = (y * w + x) * 4;
      data[i] = c[0] * ombre;
      data[i + 1] = c[1] * ombre;
      data[i + 2] = c[2] * ombre;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

let carteEnCache: ImageDataLike | null = null;

/** La carte de la scène de référence, redressée avec ses vrais coins (calculée une fois). */
function carteRedressee(): ImageDataLike {
  if (!carteEnCache) {
    const scene = scenesDeReference().find((s) => s.nom === "petite carte sur table claire")!;
    const { largeur, hauteur } = tailleSortie(scene.verite);
    carteEnCache = redresser(scene.image, scene.verite, largeur, hauteur)!;
  }
  return carteEnCache;
}

describe("Magic color", () => {
  const source = pageJaunieAvecOmbre();
  const sortie = magicColor(source);

  it("rend un papier jauni neutre et blanc, y compris dans l'ombre", () => {
    for (const [x0, x1] of [[0.02, 0.1], [0.9, 0.98]]) {
      const papier = moyenne(sortie, x0, 0.88, x1, 0.98);
      expect(lum(papier), `luminance du papier (${x0})`).toBeGreaterThan(238);
      expect(saturation(papier), `dominante résiduelle (${x0})`).toBeLessThan(14);
    }
  });

  it("rend neutre un papier dont la teinte change d'une zone à l'autre (reflet bleuté d'un côté, lampe chaude de l'autre)", () => {
    // Régression : seule une balance des blancs globale était appliquée, donc la zone bleutée restait bleue.
    const w = 240, h = 180;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = x / (w - 1);
        let c: Rvb = [244 + (226 - 244) * t, 236 + (238 - 236) * t, 214 + (252 - 214) * t]; // chaud → bleuté
        if (y % 22 > 15 && x > 20 && x < 220 && y > 70) c = [40, 38, 44]; // lignes de texte
        const i = (y * w + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }
    const apres = magicColor({ data, width: w, height: h });
    // Haut de page : vierge de texte (les lignes commencent à y = 70 sur 180).
    for (const [x0, x1] of [[0.02, 0.12], [0.88, 0.98]]) {
      const papier = moyenne(apres, x0, 0.05, x1, 0.35);
      expect(lum(papier), `luminance du papier (${x0})`).toBeGreaterThan(238);
      expect(saturation(papier), `dominante résiduelle (${x0})`).toBeLessThan(8);
    }
  });

  it("n'étale pas de tache grise là où l'ombre rencontre le texte (l'encre bleutée n'est pas « colorée »)", () => {
    // Régression : l'encre noire légèrement bleutée était prise pour du contenu coloré à
    // protéger, ce qui relevait le fond estimé et laissait une tache grise près de l'ombre.
    let somme = 0, n = 0;
    for (let y = 118; y < 122; y++) {
      for (let x = Math.floor(0.5 * sortie.width); x < Math.floor(0.7 * sortie.width); x++) {
        somme += lum(pixel(sortie, x, y));
        n++;
      }
    }
    expect(somme / n).toBeGreaterThan(235);
  });

  it("garde l'encre sombre", () => {
    expect(lum(pixel(sortie, 100, 84))).toBeLessThan(90);
  });

  it("ne blanchit pas une grande photo colorée et garde sa teinte (le brun ne devient pas pêche)", () => {
    const carte = carteRedressee();
    const apres = magicColor(carte);
    const avant = moyenne(carte, 0.12, 0.38, 0.28, 0.7);
    const photo = moyenne(apres, 0.12, 0.38, 0.28, 0.7);
    expect(ecartTeinte(avant, photo)).toBeLessThan(12);
    expect(lum(photo), "la photo doit rester nettement plus sombre que le fond").toBeLessThan(0.7 * lum(moyenne(apres, 0.45, 0.4, 0.9, 0.55)));
  });

  it("conserve la teinte d'une zone rouge (écart < 12°) et sa saturation", () => {
    const avant = moyenne(source, 0.14, 0.14, 0.27, 0.26);
    const apres = moyenne(sortie, 0.14, 0.14, 0.27, 0.26);
    expect(ecartTeinte(avant, apres)).toBeLessThan(12);
    expect(saturation(apres)).toBeGreaterThan(0.6 * saturation(avant));
  });
});

describe("Noir & blanc", () => {
  const source = pageJaunieAvecOmbre();
  const sortie = noirEtBlanc(source);

  it("rend le papier d'un blanc pur partout, y compris sous l'ombre portée", () => {
    // Zones sans texte ni logo : à gauche (éclairée), au milieu, à droite (sous l'ombre).
    for (const [x0, x1, y0, y1] of [[0.02, 0.08, 0.88, 0.98], [0.45, 0.65, 0.05, 0.35], [0.8, 0.98, 0.05, 0.35]]) {
      const papier = moyenne(sortie, x0, y0, x1, y1);
      expect(lum(papier), `luminance du papier (${x0})`).toBeGreaterThan(250);
      expect(saturation(papier), `dominante résiduelle (${x0})`).toBe(0);
    }
  });

  it("n'étale pas de tache grise là où l'ombre rencontre le texte", () => {
    let somme = 0, n = 0;
    for (let y = 118; y < 122; y++) {
      for (let x = Math.floor(0.5 * sortie.width); x < Math.floor(0.7 * sortie.width); x++) {
        somme += lum(pixel(sortie, x, y));
        n++;
      }
    }
    expect(somme / n).toBeGreaterThan(250);
  });

  it("garde l'encre noire, dans la zone d'ombre comme hors de l'ombre", () => {
    expect(lum(pixel(sortie, 100, 84))).toBeLessThan(40);
    expect(lum(pixel(sortie, 160, 84))).toBeLessThan(40);
  });

  it("ne laisse aucune couleur (le logo rouge devient un aplat sombre ou gris)", () => {
    expect(saturation(moyenne(sortie, 0.14, 0.14, 0.27, 0.26))).toBe(0);
  });
});

describe("Couleurs fidèles", () => {
  it("atténue d'au moins 30 % une forte ombre étendue (gain borné : Magic color est fait pour les ombres fortes)", () => {
    const source = pageJaunieAvecOmbre();
    const sortie = couleursFideles(source);
    const ecart = (img: ImageDataLike) => lum(moyenne(img, 0.02, 0.88, 0.1, 0.98)) - lum(moyenne(img, 0.9, 0.88, 0.98, 0.98));
    expect(ecart(sortie)).toBeLessThan(0.7 * ecart(source));
  });

  it("conserve la teinte du bandeau bleu d'une carte (écart < 4°)", () => {
    const source = carteRedressee();
    const sortie = couleursFideles(source);
    const avant = moyenne(source, 0.45, 0.04, 0.9, 0.12);
    const apres = moyenne(sortie, 0.45, 0.04, 0.9, 0.12);
    expect(ecartTeinte(avant, apres)).toBeLessThan(4);
  });

  it("n'aplatit pas la photo sombre d'une carte (rapport photo/fond conservé à ±15 %)", () => {
    const source = carteRedressee();
    const sortie = couleursFideles(source);
    const rapport = (img: ImageDataLike) => lum(moyenne(img, 0.12, 0.38, 0.28, 0.7)) / lum(moyenne(img, 0.45, 0.4, 0.9, 0.55));
    expect(rapport(sortie) / rapport(source)).toBeGreaterThan(0.85);
    expect(rapport(sortie) / rapport(source)).toBeLessThan(1.15);
  });

  it("garde la teinte et la saturation du fond d'une carte colorée", () => {
    const source = carteRedressee();
    const fidele = moyenne(couleursFideles(source), 0.45, 0.4, 0.9, 0.55);
    const original = moyenne(source, 0.45, 0.4, 0.9, 0.55);
    expect(ecartTeinte(original, fidele)).toBeLessThan(4);
    expect(saturation(fidele)).toBeGreaterThan(0.8 * saturation(original));
  });
});
