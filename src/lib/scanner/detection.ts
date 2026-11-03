// Détection des bords d'une feuille sur une image RGBA (miniature).
//
// Méthode volontairement légère (pas d'OpenCV) : niveaux de gris → flou →
// seuil d'Otsu → plus grande zone claire connexe → quatre coins extrêmes.
// Elle suppose une feuille plus claire que son support (cas courant d'un
// document posé sur une table) ; sinon elle renvoie null et l'écran de
// recadrage propose un cadre par défaut que l'utilisateur ajuste à la main.

import { aireQuad, ordonnerCoins, quadValide, type ImageDataLike, type Point, type Quad } from "./geometrie";

/** Côté de travail : assez fin pour les coins, assez petit pour tourner en live. */
const COTE_DETECTION_PX = 240;
/** La feuille doit couvrir au moins cette part de l'image... */
const PART_MIN = 0.12;
/** ...et pas (presque) toute l'image, signe que le seuil n'a rien séparé. */
const PART_MAX = 0.97;

function niveauxDeGris(img: ImageDataLike): Uint8Array {
  const { data, width, height } = img;
  const gris = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gris.length; i++, p += 4) {
    gris[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }
  return gris;
}

/** Flou de boîte 3×3, appliqué `passes` fois (≈ flou gaussien). */
function flouter(gris: Uint8Array, w: number, h: number, passes: number): Uint8Array {
  let src = gris;
  for (let n = 0; n < passes; n++) {
    const dst = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
      const y0 = y > 0 ? y - 1 : y;
      const y1 = y < h - 1 ? y + 1 : y;
      for (let x = 0; x < w; x++) {
        const x0 = x > 0 ? x - 1 : x;
        const x1 = x < w - 1 ? x + 1 : x;
        const s =
          src[y0 * w + x0] + src[y0 * w + x] + src[y0 * w + x1] +
          src[y * w + x0] + src[y * w + x] + src[y * w + x1] +
          src[y1 * w + x0] + src[y1 * w + x] + src[y1 * w + x1];
        dst[y * w + x] = Math.round(s / 9);
      }
    }
    src = dst;
  }
  return src;
}

/** Seuil d'Otsu : maximise la variance entre les classes sombre et claire. */
export function seuilOtsu(gris: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gris.length; i++) hist[gris[i]]++;
  const total = gris.length;
  let sommeTotale = 0;
  for (let t = 0; t < 256; t++) sommeTotale += t * hist[t];
  let sommeFond = 0;
  let poidsFond = 0;
  let meilleurSeuil = 127;
  let meilleureVariance = -1;
  for (let t = 0; t < 256; t++) {
    poidsFond += hist[t];
    if (poidsFond === 0) continue;
    const poidsForme = total - poidsFond;
    if (poidsForme === 0) break;
    sommeFond += t * hist[t];
    const moyFond = sommeFond / poidsFond;
    const moyForme = (sommeTotale - sommeFond) / poidsForme;
    const variance = poidsFond * poidsForme * (moyFond - moyForme) ** 2;
    if (variance > meilleureVariance) {
      meilleureVariance = variance;
      meilleurSeuil = t;
    }
  }
  return meilleurSeuil;
}

/** Plus grande composante connexe (4-voisins) du masque ; renvoie ses indices. */
function plusGrandeZone(masque: Uint8Array, w: number, h: number): number[] {
  const visite = new Uint8Array(masque.length);
  let meilleure: number[] = [];
  const pile: number[] = [];
  for (let depart = 0; depart < masque.length; depart++) {
    if (!masque[depart] || visite[depart]) continue;
    const zone: number[] = [];
    pile.push(depart);
    visite[depart] = 1;
    while (pile.length) {
      const i = pile.pop()!;
      zone.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0 && masque[i - 1] && !visite[i - 1]) { visite[i - 1] = 1; pile.push(i - 1); }
      if (x < w - 1 && masque[i + 1] && !visite[i + 1]) { visite[i + 1] = 1; pile.push(i + 1); }
      if (y > 0 && masque[i - w] && !visite[i - w]) { visite[i - w] = 1; pile.push(i - w); }
      if (y < h - 1 && masque[i + w] && !visite[i + w]) { visite[i + w] = 1; pile.push(i + w); }
    }
    if (zone.length > meilleure.length) meilleure = zone;
  }
  return meilleure;
}

/**
 * Cherche la feuille dans `img` (idéalement ≤ COTE_DETECTION_PX).
 * Renvoie les 4 coins ordonnés, en pixels de `img`, ou null si rien de fiable.
 */
export function detecterQuadrilatere(img: ImageDataLike): Quad | null {
  const { width: w, height: h } = img;
  if (w < 8 || h < 8) return null;

  const gris = flouter(niveauxDeGris(img), w, h, 2);
  const seuil = seuilOtsu(gris);
  const masque = new Uint8Array(gris.length);
  for (let i = 0; i < gris.length; i++) masque[i] = gris[i] > seuil ? 1 : 0;

  const zone = plusGrandeZone(masque, w, h);
  const part = zone.length / (w * h);
  if (part < PART_MIN || part > PART_MAX) return null;

  // Coins extrêmes de la zone : min/max de x+y et de x−y.
  let hg: Point | null = null, bd: Point | null = null, hd: Point | null = null, bg: Point | null = null;
  let minS = Infinity, maxS = -Infinity, minD = Infinity, maxD = -Infinity;
  for (const i of zone) {
    const x = i % w;
    const y = (i - x) / w;
    const s = x + y;
    const d = x - y;
    if (s < minS) { minS = s; hg = { x, y }; }
    if (s > maxS) { maxS = s; bd = { x: x + 1, y: y + 1 }; }
    if (d > maxD) { maxD = d; hd = { x: x + 1, y }; }
    if (d < minD) { minD = d; bg = { x, y: y + 1 }; }
  }
  if (!hg || !hd || !bd || !bg) return null;

  const quad = ordonnerCoins([hg, hd, bd, bg]);
  if (!quadValide(quad)) return null;
  // Les coins extrêmes d'une zone très irrégulière peuvent donner un quad
  // bien plus petit que la zone : on le rejette plutôt que de mal cadrer.
  if (aireQuad(quad) < zone.length * 0.6) return null;
  return quad;
}

/**
 * Réduit une image à `COTE_DETECTION_PX` (sans canvas) pour la détection.
 * Renvoie l'image réduite et le facteur d'agrandissement (réduit → original).
 */
export function reduirePourDetection(
  img: ImageDataLike,
  coteMax = COTE_DETECTION_PX
): { image: ImageDataLike; facteur: number } {
  const { width, height, data } = img;
  const echelle = Math.min(1, coteMax / Math.max(width, height));
  if (echelle === 1) return { image: img, facteur: 1 };
  const w = Math.max(1, Math.round(width * echelle));
  const h = Math.max(1, Math.round(height * echelle));
  const sortie = new Uint8ClampedArray(w * h * 4);
  const facteur = width / w;
  const fy = height / h;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.floor((y + 0.5) * fy));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * facteur));
      const s = (sy * width + sx) * 4;
      const o = (y * w + x) * 4;
      sortie[o] = data[s];
      sortie[o + 1] = data[s + 1];
      sortie[o + 2] = data[s + 2];
      sortie[o + 3] = 255;
    }
  }
  return { image: { data: sortie, width: w, height: h }, facteur };
}
