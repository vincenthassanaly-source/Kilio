// Scènes de régression du scanner (tests uniquement, aucune dépendance au DOM) : les cas où la
// chaîne de production faisait pire que le direct (blanc sur blanc, nappe à carreaux, coin hors
// champ), un document tourné de 45°, et des pages déjà redressées pour juger le filtre « Magique »
// (photo dans une ombre, logo dans un coin vignetté sous faible lumière). Tirages à graine fixe.
//
// Les métriques comparent les coins sans tenir compte de leur ordre : un détecteur juste ne doit
// pas être pénalisé parce qu'il commence par un autre coin.

import { aireQuad, type ImageDataLike, type Quad } from "./geometrie";
import { fabriquerScene, rectangleTourne, type OptionsScene, type Scene } from "./scenes";

const W = 640;
const H = 480;

/** Feuille A4 en légère perspective, au milieu du champ. */
const A4: Quad = [{ x: 190, y: 50 }, { x: 445, y: 62 }, { x: 462, y: 425 }, { x: 165, y: 418 }];

function copie(img: ImageDataLike): ImageDataLike {
  return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height };
}

function dansConvexe(q: Quad, x: number, y: number): boolean {
  let signe = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (c === 0) continue;
    if (signe === 0) signe = Math.sign(c);
    else if (Math.sign(c) !== signe) return false;
  }
  return true;
}

/** Quadrillage sombre sur le fond, hors du document (nappe à carreaux). */
function quadrillage(scene: Scene, pas: number, niveau: number, epaisseur: number): Scene {
  const img = copie(scene.image);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (dansConvexe(scene.verite, x + 0.5, y + 0.5)) continue;
      if (x % pas < epaisseur || y % pas < epaisseur) {
        const i = (y * img.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = niveau;
      }
    }
  }
  return { ...scene, image: img };
}

function feuille(nom: string, o: Partial<OptionsScene>): Scene {
  return fabriquerScene(nom, {
    largeur: W, hauteur: H, ratio: 0.707, quad: A4, papier: [238, 236, 230], contenu: "texte", bruit: 3, graine: 31,
    fond: [120, 110, 100], ...o,
  });
}

/** Vérité d'un document qui sort du champ : chaque coin ramené dans l'image (approximation). */
export function veriteVisible(scene: Scene): Quad {
  const { width: w, height: h } = scene.image;
  return scene.verite.map((p) => ({ x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) })) as Quad;
}

/** Scènes où la chaîne photo se trompait alors que le direct OpenCV trouvait la feuille (rapports 01 et 03). */
export function scenesDifficiles(): Scene[] {
  return [
    feuille("blanc sur blanc (écart ≈ 12 niveaux)", { fond: [226, 224, 218], bruit: 4 }),
    fabriquerScene("blanc sur blanc (écart ≈ 8 niveaux, dégradé)", {
      largeur: W, hauteur: H, ratio: 0.707, quad: [{ x: 190, y: 40 }, { x: 440, y: 60 }, { x: 460, y: 430 }, { x: 160, y: 415 }],
      fond: [232, 230, 225], papier: [244, 243, 240], contenu: "texte", bruit: 3, degrade: 0.1, graine: 32,
    }),
    quadrillage(feuille("nappe à carreaux", { fond: [200, 195, 185] }), 22, 90, 2),
    feuille("document partiel (coin hors champ)", {
      quad: [{ x: 210, y: 40 }, { x: 600, y: 70 }, { x: 700, y: 520 }, { x: 180, y: 470 }],
    }),
    feuille("page plus haute que le champ", {
      quad: [{ x: 150, y: -40 }, { x: 500, y: -30 }, { x: 510, y: 520 }, { x: 140, y: 515 }],
    }),
  ];
}

/** Feuille tournée de 45° pile sur du bois : deux coins à égalité pour le tri par x+y et x−y. */
export function sceneRotation45(): { scene: Scene; coins: Quad } {
  const coins = rectangleTourne(320, 240, 200, 280, 45);
  const scene = fabriquerScene("feuille tournée de 45° sur bois", {
    largeur: W, hauteur: H, ratio: 0.707, quad: coins, fond: [168, 128, 88], grainBois: 20,
    papier: [240, 238, 232], contenu: "texte", bruit: 3, graine: 38,
  });
  return { scene, coins };
}

/* ---------- Métriques géométriques ---------- */

/** Erreur maximale d'un coin (fraction de la diagonale) pour la meilleure correspondance des coins (rotation ou sens inverse). */
export function erreurCoinsSansOrdre(trouve: Quad, verite: Quad, largeur: number, hauteur: number): number {
  const diagonale = Math.hypot(largeur, hauteur);
  let meilleur = Infinity;
  for (const sens of [1, -1]) {
    for (let decalage = 0; decalage < 4; decalage++) {
      let pire = 0;
      for (let i = 0; i < 4; i++) {
        const p = trouve[(decalage + sens * i + 8) % 4];
        pire = Math.max(pire, Math.hypot(p.x - verite[i].x, p.y - verite[i].y));
      }
      meilleur = Math.min(meilleur, pire);
    }
  }
  return meilleur / diagonale;
}

/** Intersection sur union de deux quadrilatères convexes, par échantillonnage sur une grille fine. */
export function iouQuads(a: Quad, b: Quad, largeur: number, hauteur: number): number {
  const pas = Math.max(1, Math.round(Math.max(largeur, hauteur) / 400));
  let inter = 0;
  let union = 0;
  const xs = [...a, ...b].map((p) => p.x);
  const ys = [...a, ...b].map((p) => p.y);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += pas) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += pas) {
      const ia = dansConvexe(a, x + 0.5, y + 0.5);
      const ib = dansConvexe(b, x + 0.5, y + 0.5);
      if (ia && ib) inter++;
      if (ia || ib) union++;
    }
  }
  return union ? inter / union : 0;
}

/** Vrai si les 4 coins sont distincts (à plus d'un pixel les uns des autres) et forment une aire non nulle. */
export function coinsDistincts(q: Quad): boolean {
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) if (Math.hypot(q[i].x - q[j].x, q[i].y - q[j].y) < 1) return false;
  }
  return aireQuad(q) > 1;
}

/* ---------- Pages redressées pour le filtre « Magique » ---------- */

type Rvb = [number, number, number];

export type PageRendu = {
  nom: string;
  /** Page telle que photographiée (éclairage, ombre, bruit), déjà redressée. */
  image: ImageDataLike;
  /** Même contenu, papier blanc pur et sans éclairage : la référence. */
  ideale: ImageDataLike;
  /** Zones colorées à juger (fractions 0-1 de la page) : [x0, y0, x1, y1]. */
  zones: Record<"photo" | "logo" | "tampon", [number, number, number, number]>;
};

const PAGE_L = 700;
const PAGE_H = 990;

/** Contenu générique : logo, titre, lignes de texte, photo en dégradé, tampon rouge. */
function contenu(u: number, v: number): Rvb | null {
  // Logo (coin haut gauche) : carré en dégradé diagonal orange → bleu.
  if (u > 0.08 && u < 0.185 && v > 0.045 && v < 0.12) {
    const t = ((u - 0.08) / 0.105 + (v - 0.045) / 0.075) / 2;
    return [240 - 209 * t, 138 - 43 * t, 36 + 155 * t];
  }
  // Titre gras.
  if (v > 0.075 && v < 0.1 && u > 0.22 && u < 0.8) return [17, 17, 17];
  // Photo (bas droite) : ciel bleu → sable → brun, avec un soleil clair.
  if (u > 0.665 && u < 0.915 && v > 0.57 && v < 0.695) {
    if (Math.hypot((u - 0.738) * 0.707, v - 0.613) < 0.02) return [244, 231, 176];
    const t = (v - 0.57) / 0.125;
    return t < 0.55
      ? [143 + 74 * (t / 0.55), 180 + 19 * (t / 0.55), 217 - 54 * (t / 0.55)]
      : [217 - 110 * ((t - 0.55) / 0.45), 199 - 125 * ((t - 0.55) / 0.45), 163 - 116 * ((t - 0.55) / 0.45)];
  }
  // Tampon rouge (deux anneaux) en bas à gauche.
  const r = Math.hypot((u - 0.28) * 0.707, v - 0.655);
  if ((r > 0.06 && r < 0.0645) || (r > 0.048 && r < 0.05)) return [200, 32, 42];
  // Lignes de texte.
  if (v > 0.16 && v < 0.5 && u > 0.08 && u < 0.92) {
    const k = (v - 0.16) / 0.018;
    if (k - Math.floor(k) > 0.6 && u < 0.92 - (0.25 * ((Math.floor(k) * 37) % 7)) / 7) return [17, 17, 17];
  }
  return null;
}

function prng(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fabriquerPage(
  nom: string,
  o: { papier: Rvb; lumiere: Rvb; expo: number; vignette: number; ombre?: { cx: number; cy: number; rx: number; ry: number; force: number }; bruit: number }
): PageRendu {
  const w = PAGE_L, h = PAGE_H;
  const image = new Uint8ClampedArray(w * h * 4);
  const ideale = new Uint8ClampedArray(w * h * 4);
  const rand = prng(77);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w, v = (y + 0.5) / h;
      const c = contenu(u, v);
      const reflet: Rvb = c ? [c[0] / 255, c[1] / 255, c[2] / 255] : [1, 1, 1];
      const nx = u - 0.5, ny = v - 0.5;
      let L = o.expo * (1 - o.vignette * (nx * nx + ny * ny) * 2);
      if (o.ombre) {
        const d = Math.hypot((u - o.ombre.cx) / o.ombre.rx, (v - o.ombre.cy) / o.ombre.ry) - 1;
        L *= 1 - o.ombre.force / (1 + Math.exp(d * 12));
      }
      const i = (y * w + x) * 4;
      const bruit = (rand() + rand() + rand() - 1.5) * 2 * o.bruit;
      for (let k = 0; k < 3; k++) {
        image[i + k] = 255 * reflet[k] * (o.papier[k] / 255) * L * o.lumiere[k] + bruit;
        ideale[i + k] = 255 * reflet[k];
      }
      image[i + 3] = ideale[i + 3] = 255;
    }
  }
  return {
    nom,
    image: { data: image, width: w, height: h },
    ideale: { data: ideale, width: w, height: h },
    zones: { photo: [0.67, 0.575, 0.91, 0.69], logo: [0.085, 0.05, 0.18, 0.115], tampon: [0.21, 0.59, 0.35, 0.72] },
  };
}

/** Pages du rapport 02 (scènes A, B, D) en version légère : déjà redressées, à 700×990 px. */
export function pagesDeRendu(): Record<"normale" | "ombreSurPhoto" | "faibleLumiere", PageRendu> {
  const base = { papier: [246, 242, 232] as Rvb, lumiere: [1, 0.97, 0.9] as Rvb, expo: 0.92, vignette: 0.25, bruit: 3 };
  return {
    normale: fabriquerPage("lumière douce", base),
    ombreSurPhoto: fabriquerPage("ombre douce de main sur la photo", {
      ...base, ombre: { cx: 0.93, cy: 0.74, rx: 0.36, ry: 0.37, force: 0.5 },
    }),
    faibleLumiere: fabriquerPage("lampe chaude, peu de lumière, coins vignettés", {
      ...base, lumiere: [1, 0.82, 0.55], expo: 0.55, vignette: 0.4, bruit: 8,
    }),
  };
}

/* ---------- Métriques de rendu ---------- */

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) / 256;

/**
 * Fond d'une page rendue : pixels à au moins 4 px de toute encre de la référence, marges de 3 %
 * exclues. Renvoie l'écart-type de la luminance et la moyenne de la tuile de 32 px la plus sombre.
 */
export function mesurerFond(sortie: ImageDataLike, ideale: ImageDataLike): { ecartType: number; tuileMin: number; moyenne: number } {
  const { width: w, height: h } = sortie;
  const encre = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < encre.length; i++, p += 4) if (luma(ideale.data[p], ideale.data[p + 1], ideale.data[p + 2]) < 250) encre[i] = 1;
  const R = 4;
  const marge = Math.round(0.03 * Math.max(w, h));
  const T = 32;
  const tw = Math.ceil(w / T);
  const sommes = new Float64Array(tw * Math.ceil(h / T));
  const nombres = new Uint32Array(sommes.length);
  const valeurs: number[] = [];
  for (let y = marge; y < h - marge; y++) {
    for (let x = marge; x < w - marge; x++) {
      let proche = false;
      for (let dy = -R; dy <= R && !proche; dy++) for (let dx = -R; dx <= R; dx++) if (encre[(y + dy) * w + x + dx]) { proche = true; break; }
      if (proche) continue;
      const p = (y * w + x) * 4;
      const l = luma(sortie.data[p], sortie.data[p + 1], sortie.data[p + 2]);
      valeurs.push(l);
      const t = Math.floor(y / T) * tw + Math.floor(x / T);
      sommes[t] += l;
      nombres[t]++;
    }
  }
  const moyenne = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
  const ecartType = Math.sqrt(valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / valeurs.length);
  let tuileMin = 255;
  for (let t = 0; t < sommes.length; t++) if (nombres[t] > 0.5 * T * T) tuileMin = Math.min(tuileMin, sommes[t] / nombres[t]);
  return { ecartType, tuileMin, moyenne };
}

function lab(rgb: number[]): number[] {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb.map(f);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const t = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}

/** Écart de couleur CIELAB (ΔE 1976) entre les couleurs moyennes d'une zone de la sortie et de la référence. */
export function ecartCouleurZone(sortie: ImageDataLike, ideale: ImageDataLike, zone: [number, number, number, number]): number {
  const { width: w, height: h } = sortie;
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  let n = 0;
  for (let y = Math.floor(zone[1] * h); y < Math.floor(zone[3] * h); y++) {
    for (let x = Math.floor(zone[0] * w); x < Math.floor(zone[2] * w); x++) {
      const p = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) {
        a[k] += sortie.data[p + k];
        b[k] += ideale.data[p + k];
      }
      n++;
    }
  }
  const la = lab(a.map((v) => v / n));
  const lb = lab(b.map((v) => v / n));
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** Moyenne de luminance des `n` premières et dernières lignes et colonnes. */
export function luminanceDesBords(img: ImageDataLike, n = 2): number {
  const { width: w, height: h, data } = img;
  let s = 0;
  let k = 0;
  const ajouter = (x: number, y: number) => {
    const p = (y * w + x) * 4;
    s += luma(data[p], data[p + 1], data[p + 2]);
    k++;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (y < n || y >= h - n || x < n || x >= w - n) ajouter(x, y);
  return s / k;
}

