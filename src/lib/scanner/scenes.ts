// Générateur de scènes de test : une « photo » synthétique d'un document posé
// sur un support (table claire, bois, tissu…), avec perspective, ombres,
// éclairage inégal, grain et flou, et les vrais coins pour mesurer l'erreur.
// Sert uniquement aux tests : aucune dépendance au DOM, tirage pseudo-aléatoire
// à graine fixe donc résultats reproductibles.

import { homographie, ordonnerCoins, type ImageDataLike, type Point, type Quad } from "./geometrie";

type Couleur = [number, number, number];

type OptionsScene = {
  largeur: number;
  hauteur: number;
  /** Coins du document dans l'image (HG, HD, BD, BG). */
  quad: Quad;
  fond: Couleur;
  /** Amplitude (0-255) d'un grain de bois en bandes. */
  grainBois?: number;
  papier: Couleur;
  contenu: "texte" | "carte";
  /** Rapport largeur/hauteur de l'objet réel (sert à placer le contenu). */
  ratio: number;
  /** Rayon des coins arrondis, en % de la hauteur réelle (cartes). */
  arrondi?: number;
  /** Ombre portée sur tout le côté droit : position (0-1) et force (0-1). */
  ombre?: { x: number; force: number };
  /** Bord net de table : à gauche de cette position (0-1, légèrement incliné), le support est plus sombre. */
  bordTable?: number;
  /** Dégradé d'éclairage global (0 = uniforme). */
  degrade?: number;
  bruit?: number;
  flou?: boolean;
  graine?: number;
};

export type Scene = {
  nom: string;
  image: ImageDataLike;
  verite: Quad;
};

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

function inverse3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
}

const lisse = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Distance signée (positive à l'intérieur) d'un point à un polygone convexe. */
function distanceInterieure(quad: Quad, p: Point, sens: number): number {
  let d = Infinity;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const longueur = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const croix = ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / longueur;
    d = Math.min(d, sens * croix);
  }
  return d;
}

/** Contenu d'une feuille : lignes de texte noires de longueurs variées. */
function lignesDeTexte(rand: () => number): { v: number; fin: number }[] {
  const lignes: { v: number; fin: number }[] = [];
  for (let v = 0.1; v < 0.9; v += 0.055) {
    if (rand() < 0.12) continue; // saut de paragraphe
    lignes.push({ v, fin: 0.45 + rand() * 0.45 });
  }
  return lignes;
}

function fabriquerScene(nom: string, o: OptionsScene): Scene {
  const { largeur: w, hauteur: h } = o;
  const rand = prng(o.graine ?? 1);
  const quad = o.quad;
  // Sens de parcours : l'aire signée dit si la distance intérieure est du bon côté.
  let aire = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    aire += a.x * b.y - b.x * a.y;
  }
  const sens = aire > 0 ? 1 : -1;
  const H = homographie(quad, 1, 1)!;
  const Hi = inverse3(H);
  const lignes = lignesDeTexte(rand);
  const data = new Uint8ClampedArray(w * h * 4);
  const hauteurReelle = 100;
  const largeurReelle = o.ratio * hauteurReelle;
  const rayon = (o.arrondi ?? 0) * hauteurReelle;
  // Pixels écran par unité réelle (approximation moyenne) pour convertir l'arrondi.
  const echelleEcran = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) / largeurReelle;
  const phase = rand() * 6.28;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = { x: x + 0.5, y: y + 0.5 };
      // Position dans le repère du document (u, v) ∈ [0,1]².
      const z = Hi[6] * p.x + Hi[7] * p.y + Hi[8];
      const u = (Hi[0] * p.x + Hi[1] * p.y + Hi[2]) / z;
      const v = (Hi[3] * p.x + Hi[4] * p.y + Hi[5]) / z;

      let d = distanceInterieure(quad, p, sens);
      if (rayon > 0 && d > -1) {
        const qx = Math.abs(u - 0.5) * largeurReelle - (largeurReelle / 2 - rayon);
        const qy = Math.abs(v - 0.5) * hauteurReelle - (hauteurReelle / 2 - rayon);
        const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rayon;
        if (sdf > 0) d = Math.min(d, -sdf * echelleEcran);
      }
      const couverture = Math.min(1, Math.max(0, d + 0.5));

      // Fond : couleur + grain de bois éventuel.
      let fond: Couleur = [...o.fond];
      if (o.grainBois) {
        const g =
          Math.sin(((x * 0.9 + y * 0.25) / 11) * 6.28 + 0.8 * Math.sin(((y * 0.9 - x * 0.2) / 70) * 6.28 + phase)) *
          o.grainBois;
        fond = [fond[0] + g, fond[1] + g * 0.9, fond[2] + g * 0.8];
      }
      // Bord de table : un second support, plus sombre, de l'autre côté d'une arête franche.
      if (o.bordTable !== undefined && x < o.bordTable * w + 0.08 * (y - h / 2)) {
        fond = [fond[0] * 0.5, fond[1] * 0.5, fond[2] * 0.5];
      }
      // Ombre de contact juste à l'extérieur du document.
      if (d < 0 && d > -7) {
        const k = 1 - 0.16 * Math.exp(d / 2.5);
        fond = [fond[0] * k, fond[1] * k, fond[2] * k];
      }

      // Document : papier + contenu.
      let doc: Couleur = [...o.papier];
      if (o.contenu === "texte") {
        for (const l of lignes) {
          if (Math.abs(v - l.v) < 0.011 && u > 0.1 && u < l.fin) doc = [34, 34, 44];
        }
      } else {
        if (v < 0.17) doc = [55, 95, 165];
        else if (u > 0.07 && u < 0.34 && v > 0.27 && v < 0.82) doc = [128, 104, 92];
        else {
          for (const l of lignes) {
            if (l.v > 0.25 && Math.abs(v - l.v * 0.98) < 0.014 && u > 0.42 && u < 0.42 + (l.fin - 0.4) * 0.9) doc = [40, 40, 50];
          }
        }
      }

      let r = fond[0] * (1 - couverture) + doc[0] * couverture;
      let g2 = fond[1] * (1 - couverture) + doc[1] * couverture;
      let b = fond[2] * (1 - couverture) + doc[2] * couverture;

      // Éclairage : dégradé global puis ombre portée.
      const lumiere = 1 + (o.degrade ?? 0) * ((x / w - 0.5) * 0.8 + (y / h - 0.5) * 0.6);
      const ombre = o.ombre ? 1 - o.ombre.force * lisse(o.ombre.x - 0.08, o.ombre.x + 0.08, x / w) : 1;
      const k = lumiere * ombre;
      r *= k;
      g2 *= k;
      b *= k;

      const i = (y * w + x) * 4;
      const grain = o.bruit ? (rand() + rand() + rand() - 1.5) * o.bruit * 2 : 0;
      data[i] = r + grain;
      data[i + 1] = g2 + grain;
      data[i + 2] = b + grain;
      data[i + 3] = 255;
    }
  }

  if (o.flou) {
    const copie = new Uint8ClampedArray(data);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += copie[((y + dy) * w + x + dx) * 4 + c];
          data[(y * w + x) * 4 + c] = s / 9;
        }
      }
    }
  }

  return { nom, image: { data, width: w, height: h }, verite: ordonnerCoins([...quad]) };
}

const W = 640;
const H = 480;

/** Coins d'un rectangle de `l`×`h` pixels centré en (cx, cy) et tourné de `deg` degrés. */
function rectangleTourne(cx: number, cy: number, l: number, h: number, deg: number): Quad {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const pt = (dx: number, dy: number): Point => ({ x: cx + dx * c - dy * s, y: cy + dx * s + dy * c });
  return [pt(-l / 2, -h / 2), pt(l / 2, -h / 2), pt(l / 2, h / 2), pt(-l / 2, h / 2)];
}

/** Erreur maximale d'un coin, en fraction de la diagonale de l'image. */
export function erreurCoins(trouve: Quad, verite: Quad, largeur: number, hauteur: number): number {
  const diagonale = Math.hypot(largeur, hauteur);
  let pire = 0;
  for (let i = 0; i < 4; i++) {
    pire = Math.max(pire, Math.hypot(trouve[i].x - verite[i].x, trouve[i].y - verite[i].y) / diagonale);
  }
  return pire;
}

/** Cas limite : contraste très faible, détection non garantie (mais sans faux cadre). */
export function sceneLimite(): Scene {
  return fabriquerScene("feuille très peu contrastée (limite)", {
    largeur: W, hauteur: H, ratio: 0.707,
    quad: [{ x: 190, y: 40 }, { x: 440, y: 60 }, { x: 460, y: 430 }, { x: 160, y: 415 }],
    fond: [212, 206, 196], papier: [232, 230, 224], contenu: "texte", bruit: 3, graine: 23,
  });
}

/** Les situations difficiles évoquées par l'utilisateur, plus quelques témoins. */
export function scenesDeReference(): Scene[] {
  return [
    fabriquerScene("feuille blanche sur table claire", {
      largeur: W, hauteur: H, ratio: 0.707,
      quad: [{ x: 190, y: 40 }, { x: 440, y: 60 }, { x: 460, y: 430 }, { x: 160, y: 415 }],
      fond: [214, 200, 178], papier: [238, 236, 230], contenu: "texte", bruit: 3, graine: 11, degrade: 0.12,
    }),
    fabriquerScene("petite carte sur table claire", {
      largeur: W, hauteur: H, ratio: 1.586, arrondi: 0.05,
      quad: [{ x: 250, y: 190 }, { x: 410, y: 176 }, { x: 424, y: 282 }, { x: 262, y: 296 }],
      fond: [206, 190, 166], grainBois: 10, papier: [214, 226, 238], contenu: "carte", bruit: 3, graine: 12, flou: true,
    }),
    fabriquerScene("carte sombre sur table claire", {
      largeur: W, hauteur: H, ratio: 1.586, arrondi: 0.05,
      quad: [{ x: 220, y: 160 }, { x: 420, y: 190 }, { x: 396, y: 312 }, { x: 196, y: 284 }],
      fond: [222, 212, 196], papier: [52, 62, 84], contenu: "carte", bruit: 3, graine: 13,
    }),
    fabriquerScene("feuille sur fond sombre (témoin)", {
      largeur: W, hauteur: H, ratio: 0.707,
      quad: [{ x: 170, y: 30 }, { x: 460, y: 50 }, { x: 480, y: 440 }, { x: 150, y: 420 }],
      fond: [52, 46, 40], papier: [240, 238, 232], contenu: "texte", bruit: 3, graine: 14,
    }),
    fabriquerScene("feuille sur grain de bois", {
      largeur: W, hauteur: H, ratio: 0.707,
      quad: [{ x: 180, y: 50 }, { x: 450, y: 40 }, { x: 470, y: 420 }, { x: 150, y: 430 }],
      fond: [168, 128, 88], grainBois: 26, papier: [240, 238, 230], contenu: "texte", bruit: 3, graine: 15,
    }),
    fabriquerScene("ticket étroit sur tissu", {
      largeur: W, hauteur: H, ratio: 0.3,
      quad: [{ x: 280, y: 30 }, { x: 372, y: 40 }, { x: 350, y: 440 }, { x: 262, y: 428 }],
      fond: [150, 140, 128], papier: [246, 246, 240], contenu: "texte", bruit: 4, graine: 16,
    }),
    fabriquerScene("feuille avec ombre portée", {
      largeur: W, hauteur: H, ratio: 0.707,
      quad: [{ x: 170, y: 45 }, { x: 430, y: 40 }, { x: 450, y: 425 }, { x: 150, y: 430 }],
      fond: [186, 172, 150], papier: [240, 238, 232], contenu: "texte", ombre: { x: 0.5, force: 0.42 }, bruit: 3, graine: 17,
    }),
    fabriquerScene("perspective forte", {
      largeur: W, hauteur: H, ratio: 0.707,
      quad: [{ x: 230, y: 40 }, { x: 410, y: 40 }, { x: 520, y: 440 }, { x: 120, y: 440 }],
      fond: [70, 62, 56], papier: [238, 236, 230], contenu: "texte", bruit: 3, graine: 18,
    }),
    fabriquerScene("feuille presque plein cadre", {
      largeur: W, hauteur: H, ratio: 1.414,
      quad: [{ x: 28, y: 22 }, { x: 612, y: 30 }, { x: 604, y: 452 }, { x: 22, y: 446 }],
      fond: [56, 50, 44], papier: [238, 236, 230], contenu: "texte", bruit: 3, graine: 19,
    }),
    fabriquerScene("feuille tournée de 25° sur table claire", {
      largeur: W, hauteur: H, ratio: 0.707,
      quad: rectangleTourne(320, 240, 210, 300, 25),
      fond: [208, 194, 170], papier: [240, 238, 232], contenu: "texte", bruit: 3, graine: 20, degrade: 0.1,
    }),
    fabriquerScene("carte devant un bord de table", {
      largeur: W, hauteur: H, ratio: 1.586, arrondi: 0.05,
      quad: [{ x: 270, y: 150 }, { x: 440, y: 168 }, { x: 428, y: 276 }, { x: 258, y: 258 }],
      fond: [212, 198, 174], bordTable: 0.62, papier: [214, 226, 238], contenu: "carte", bruit: 3, graine: 21,
    }),
    fabriquerScene("ticket bruité sur table claire", {
      largeur: W, hauteur: H, ratio: 0.3,
      quad: [{ x: 300, y: 36 }, { x: 392, y: 46 }, { x: 372, y: 440 }, { x: 282, y: 430 }],
      fond: [204, 192, 176], papier: [246, 246, 240], contenu: "texte", bruit: 9, flou: true, graine: 22,
    }),
  ];
}
