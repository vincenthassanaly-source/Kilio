// Redressement de l'angle des lignes de texte. Pur, sans DOM.
//
// Après le redressement de perspective, une page peut rester tournée de quelques degrés (cadre
// légèrement de travers à la prise). On mesure l'angle des lignes de texte et on fait pivoter la
// page pour les rendre horizontales, mais seulement si l'angle est net : sans texte repérable
// (photo, carte, page presque vide), la page n'est pas touchée.
//
// Mesure : profil de projection. Pour chaque angle essayé, les pixels sombres sont projetés sur
// l'axe vertical tourné ; quand les lignes sont horizontales, les pixels s'empilent dans peu de
// rangées et la somme des carrés du profil est maximale.

import { reduirePourDetection } from "./detection";
import type { ImageDataLike } from "./geometrie";

/** Plus grand côté de l'image d'analyse (pixels). */
const COTE_ANALYSE_PX = 900;
/** Plage d'angles essayés (degrés) et pas de la première passe, puis de l'affinage. */
const ANGLE_MAX_DEG = 6;
const PAS_GROSSIER_DEG = 0.25;
const PAS_FIN_DEG = 0.05;
/** Rayon (pixels d'analyse) de la moyenne locale qui sert de fond pour repérer l'encre. */
const RAYON_FOND = 14;
/** Un pixel est de l'encre s'il est sous cette part de son fond local. */
const SEUIL_ENCRE = 0.72;
/** Part minimale de pixels d'encre : en dessous, pas assez de texte pour mesurer. */
const ENCRE_MIN = 0.003;
/** Nombre maximal de pixels d'encre utilisés (sous-échantillonnage régulier au-delà). */
const ENCRE_MAX = 60000;
/** Angle minimal corrigé : en dessous, la page est déjà droite à l'œil. */
const ANGLE_MIN_DEG = 0.4;
/** Le meilleur angle doit dépasser nettement la moyenne des scores, et le score à 0°. */
const CONTRASTE_MIN = 1.15;
const GAIN_SUR_ZERO_MIN = 1.03;

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) / 256;

/** Coordonnées des pixels d'encre de l'image réduite. */
function pixelsEncre(img: ImageDataLike): { xs: Float32Array; ys: Float32Array; part: number } {
  const { data, width: w, height: h } = img;
  const gris = new Float32Array(w * h);
  for (let i = 0, p = 0; i < gris.length; i++, p += 4) gris[i] = luma(data[p], data[p + 1], data[p + 2]);

  // Fond local par moyenne glissante séparable (sommes cumulées sur les lignes puis les colonnes).
  const horiz = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const ligne = y * w;
    let somme = 0;
    const cumul = new Float32Array(w + 1);
    for (let x = 0; x < w; x++) {
      somme += gris[ligne + x];
      cumul[x + 1] = somme;
    }
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - RAYON_FOND);
      const b = Math.min(w, x + RAYON_FOND + 1);
      horiz[ligne + x] = (cumul[b] - cumul[a]) / (b - a);
    }
  }
  const fond = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    const cumul = new Float32Array(h + 1);
    let somme = 0;
    for (let y = 0; y < h; y++) {
      somme += horiz[y * w + x];
      cumul[y + 1] = somme;
    }
    for (let y = 0; y < h; y++) {
      const a = Math.max(0, y - RAYON_FOND);
      const b = Math.min(h, y + RAYON_FOND + 1);
      fond[y * w + x] = (cumul[b] - cumul[a]) / (b - a);
    }
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (fond[i] > 40 && gris[i] < SEUIL_ENCRE * fond[i]) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  const part = xs.length / (w * h);
  const pas = Math.max(1, Math.ceil(xs.length / ENCRE_MAX));
  const sx = new Float32Array(Math.ceil(xs.length / pas));
  const sy = new Float32Array(sx.length);
  for (let i = 0, j = 0; i < xs.length; i += pas, j++) {
    sx[j] = xs[i];
    sy[j] = ys[i];
  }
  return { xs: sx, ys: sy, part };
}

/** Somme des carrés du profil de projection des points pour un angle (radians). */
function score(xs: Float32Array, ys: Float32Array, hauteur: number, largeur: number, rad: number): number {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const decalage = Math.abs(sin) * largeur;
  const bins = new Uint32Array(Math.ceil(hauteur + 2 * decalage) + 2);
  for (let i = 0; i < xs.length; i++) bins[Math.floor(ys[i] * cos - xs[i] * sin + decalage)]++;
  let s = 0;
  for (let i = 0; i < bins.length; i++) s += bins[i] * bins[i];
  return s;
}

/**
 * Angle des lignes de texte, en degrés (positif : les lignes descendent vers la droite), ou null
 * si le texte est trop rare ou l'angle trop peu net pour être fiable.
 */
export function angleDesLignes(img: ImageDataLike): number | null {
  const { image } = reduirePourDetection(img, COTE_ANALYSE_PX);
  const { xs, ys, part } = pixelsEncre(image);
  if (part < ENCRE_MIN || xs.length < 500) return null;
  const { width: w, height: h } = image;
  const rad = (deg: number) => (deg * Math.PI) / 180;

  const scores: { deg: number; s: number }[] = [];
  for (let deg = -ANGLE_MAX_DEG; deg <= ANGLE_MAX_DEG + 1e-9; deg += PAS_GROSSIER_DEG) {
    scores.push({ deg, s: score(xs, ys, h, w, rad(deg)) });
  }
  const meilleur = scores.reduce((a, b) => (b.s > a.s ? b : a));
  // Un maximum collé à la limite de la plage est ambigu (texte très incliné ou sans ligne nette).
  if (Math.abs(meilleur.deg) >= ANGLE_MAX_DEG - PAS_GROSSIER_DEG) return null;
  const moyenne = scores.reduce((s, e) => s + e.s, 0) / scores.length;
  if (meilleur.s < CONTRASTE_MIN * moyenne) return null;

  let affine = meilleur;
  for (let deg = meilleur.deg - PAS_GROSSIER_DEG; deg <= meilleur.deg + PAS_GROSSIER_DEG + 1e-9; deg += PAS_FIN_DEG) {
    const s = score(xs, ys, h, w, rad(deg));
    if (s > affine.s) affine = { deg, s };
  }
  const aZero = score(xs, ys, h, w, 0);
  if (affine.s < GAIN_SUR_ZERO_MIN * aZero) return null;
  if (Math.abs(affine.deg) < ANGLE_MIN_DEG) return null;
  return affine.deg;
}

/** Couleur du papier : moyenne des 10 % de pixels les plus clairs (échantillon régulier). */
function couleurPapier(img: ImageDataLike): [number, number, number] {
  const { data, width: w, height: h } = img;
  const pas = Math.max(1, Math.floor(Math.sqrt((w * h) / 8000)));
  const pixels: { l: number; i: number }[] = [];
  for (let y = 0; y < h; y += pas) {
    for (let x = 0; x < w; x += pas) {
      const i = (y * w + x) * 4;
      pixels.push({ l: luma(data[i], data[i + 1], data[i + 2]), i });
    }
  }
  pixels.sort((a, b) => b.l - a.l);
  const clairs = pixels.slice(0, Math.max(5, Math.floor(pixels.length * 0.1)));
  const moy = (k: number) => clairs.reduce((s, p) => s + data[p.i + k], 0) / clairs.length;
  return [moy(0), moy(1), moy(2)];
}

/** Fait pivoter l'image de `deg` degrés pour redresser des lignes inclinées de `deg` ; les coins découverts prennent la couleur du papier. */
function pivoter(img: ImageDataLike, deg: number): ImageDataLike {
  const { data, width: w, height: h } = img;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const [fr, fg, fb] = couleurPapier(img);
  const sortie = new Uint8ClampedArray(data.length);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const sx = cx + dx * cos - dy * sin;
      const sy = cy + dx * sin + dy * cos;
      const o = (y * w + x) * 4;
      if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) {
        sortie[o] = fr; sortie[o + 1] = fg; sortie[o + 2] = fb; sortie[o + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const ax = sx - x0;
      const ay = sy - y0;
      for (let k = 0; k < 3; k++) {
        const haut = data[(y0 * w + x0) * 4 + k] * (1 - ax) + data[(y0 * w + x1) * 4 + k] * ax;
        const bas = data[(y1 * w + x0) * 4 + k] * (1 - ax) + data[(y1 * w + x1) * 4 + k] * ax;
        sortie[o + k] = haut * (1 - ay) + bas * ay;
      }
      sortie[o + 3] = 255;
    }
  }
  return { data: sortie, width: w, height: h };
}

/**
 * Redresse les lignes de texte de la page si leur inclinaison est nette. Renvoie `img` elle-même,
 * sans copie, quand il n'y a rien à corriger.
 */
export function redresserLesLignes(img: ImageDataLike): ImageDataLike {
  const angle = angleDesLignes(img);
  return angle === null ? img : pivoter(img, angle);
}
