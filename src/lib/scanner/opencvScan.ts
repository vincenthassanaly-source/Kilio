// Détection de document et redressement avec OpenCV.js.
//
// `cv` est injecté (voir opencv.ts) : ces fonctions ne touchent ni au DOM ni à
// `window`, donc elles se testent sous Node avec le même moteur qu'en production.
//
// Détection : plusieurs « cartes » de l'image sont essayées (contours de Canny,
// seuillage d'Otsu clair et sombre), on garde les contours convexes qui se
// ramènent à 4 coins plausibles, et on retient le plus grand et le plus
// rectangulaire. Rien de fiable → null, et l'écran de recadrage prend le relais.

import { aireQuad, mettreAEchelle, ordonnerCoins, quadValide, type ImageDataLike, type Point, type Quad } from "./geometrie";
import type { Cv } from "./opencv";

/** Côté de travail : assez fin pour de bons coins, assez petit pour le direct. */
const COTE_ANALYSE_PX = 480;
/** Part minimale de l'image qu'un document doit couvrir (une carte bancaire en occupe peu). */
const AIRE_MIN = 0.03;
/** Au-delà, c'est le cadre de l'image lui-même, pas un document. */
const AIRE_MAX = 0.985;
const ANGLE_MIN_DEG = 50;
const ANGLE_MAX_DEG = 130;
/** Rapport minimal entre deux côtés opposés (perspective forte tolérée). */
const RAPPORT_COTES_MIN = 0.35;
/** Écarts de simplification du contour, du plus fin au plus tolérant. */
/** Seuils (bas, haut) des passes de Canny, de la plus sensible à la plus stricte. */
const SEUILS_CANNY: [number, number][] = [[12, 36], [25, 75], [50, 130]];
const EPSILONS = [0.02, 0.03, 0.045, 0.065];

type Mats = { delete: () => void }[];

function angleDeg(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const cos = (v1x * v2x + v1y * v2y) / ((Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Note de 0 à 1 : coins proches de l'angle droit, côtés opposés de longueur voisine. */
function noteForme(q: Quad): number {
  let pire = 0;
  for (let i = 0; i < 4; i++) {
    const a = angleDeg(q[(i + 3) % 4], q[i], q[(i + 1) % 4]);
    if (a < ANGLE_MIN_DEG || a > ANGLE_MAX_DEG) return 0;
    pire = Math.max(pire, Math.abs(90 - a));
  }
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const r1 = Math.min(d(q[0], q[1]), d(q[2], q[3])) / (Math.max(d(q[0], q[1]), d(q[2], q[3])) || 1);
  const r2 = Math.min(d(q[1], q[2]), d(q[3], q[0])) / (Math.max(d(q[1], q[2]), d(q[3], q[0])) || 1);
  if (Math.min(r1, r2) < RAPPORT_COTES_MIN) return 0;
  return (1 - pire / 45) * 0.6 + Math.min(r1, r2) * 0.4;
}

/** Nombre de coins collés au bord de l'image : 3 ou 4 = on a trouvé le cadre, pas la feuille. */
function coinsAuBord(q: Quad, w: number, h: number): number {
  const m = Math.max(w, h) * 0.012;
  return q.filter((p) => p.x < m || p.y < m || p.x > w - m || p.y > h - m).length;
}

function quadDepuisContour(cv: Cv, contour: InstanceType<Cv["Mat"]>, mats: Mats): Quad | null {
  const hull = new cv.Mat();
  mats.push(hull);
  cv.convexHull(contour, hull, false, true);
  const peri = cv.arcLength(hull, true);
  for (const eps of EPSILONS) {
    const approx = new cv.Mat();
    mats.push(approx);
    cv.approxPolyDP(hull, approx, eps * peri, true);
    if (approx.rows === 4) {
      const d = approx.data32S;
      return ordonnerCoins([
        { x: d[0], y: d[1] },
        { x: d[2], y: d[3] },
        { x: d[4], y: d[5] },
        { x: d[6], y: d[7] },
      ]);
    }
  }
  // Contour bruité mais bien « plein » : le rectangle orienté minimal le résume.
  const rect = cv.minAreaRect(hull);
  const rad = (rect.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const hw = rect.size.width / 2, hh = rect.size.height / 2;
  const quad = ordonnerCoins(
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => ({
      x: rect.center.x + dx * cos - dy * sin,
      y: rect.center.y + dx * sin + dy * cos,
    }))
  );
  const rempli = cv.contourArea(hull) / (rect.size.width * rect.size.height || 1);
  return rempli > 0.88 ? quad : null;
}

/** Part du périmètre du quad qui longe un vrai contour de l'image (0 à 1). */
function appuiSurContours(quad: Quad, aretes: InstanceType<Cv["Mat"]>): number {
  const { cols: w, rows: h, data } = aretes;
  const N = 40;
  let touche = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    for (let k = 0; k < N; k++) {
      const t = (k + 0.5) / N;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);
      if (x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] > 0) touche++;
    }
  }
  return touche / (4 * N);
}

function meilleurDeCarte(cv: Cv, carte: InstanceType<Cv["Mat"]>, aretes: InstanceType<Cv["Mat"]>, w: number, h: number, mats: Mats): { quad: Quad; score: number } | null {
  const contours = new cv.MatVector();
  const hierarchie = new cv.Mat();
  mats.push(contours, hierarchie);
  cv.findContours(carte, contours, hierarchie, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  const aireImage = w * h;
  const gros: { i: number; aire: number }[] = [];
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const aire = cv.contourArea(c);
    c.delete();
    if (aire > aireImage * AIRE_MIN) gros.push({ i, aire });
  }
  gros.sort((a, b) => b.aire - a.aire);

  let meilleur: { quad: Quad; score: number } | null = null;
  for (const { i } of gros.slice(0, 6)) {
    const c = contours.get(i);
    mats.push(c);
    const quad = quadDepuisContour(cv, c, mats);
    if (!quad || !quadValide(quad)) continue;
    const part = aireQuad(quad) / aireImage;
    if (part < AIRE_MIN || part > AIRE_MAX) continue;
    const bord = coinsAuBord(quad, w, h);
    if (bord >= 3) continue;
    const forme = noteForme(quad);
    if (forme === 0) continue;
    // Un vrai document a ses 4 côtés sur des contours : écarte les blobs d'ombre ou de table.
    const appui = appuiSurContours(quad, aretes);
    if (appui < 0.35) continue;
    const score = part * forme * (0.3 + 0.7 * appui) * (bord === 2 ? 0.6 : bord === 1 ? 0.9 : 1);
    if (!meilleur || score > meilleur.score) meilleur = { quad, score };
  }
  return meilleur;
}

/**
 * Trouve les 4 coins du document (coordonnées de `img`) ou null.
 * `coteAnalyse` borne la taille de travail (petit en direct, plus grand sur une photo).
 */
export function detecterDocumentCv(cv: Cv, img: ImageDataLike, coteAnalyse = COTE_ANALYSE_PX): Quad | null {
  const mats: Mats = [];
  const brut = new cv.Mat(img.height, img.width, cv.CV_8UC4);
  mats.push(brut);
  brut.data.set(img.data);

  try {
    const echelle = Math.min(1, coteAnalyse / Math.max(img.width, img.height));
    let petit = brut;
    if (echelle < 1) {
      petit = new cv.Mat();
      mats.push(petit);
      cv.resize(brut, petit, new cv.Size(Math.round(img.width * echelle), Math.round(img.height * echelle)), 0, 0, cv.INTER_AREA);
    }
    const w = petit.cols;
    const h = petit.rows;

    const gris = new cv.Mat();
    const flou = new cv.Mat();
    mats.push(gris, flou);
    cv.cvtColor(petit, gris, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gris, flou, new cv.Size(5, 5), 0);

    const candidats: { quad: Quad; score: number }[] = [];
    const noyau = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    mats.push(noyau);

    // 1. Contours de Canny à plusieurs sensibilités : une feuille claire sur table
    //    claire n'a qu'un faible gradient, qu'un seuil unique raterait.
    let epais: InstanceType<Cv["Mat"]> | null = null;
    for (const [seuilBas, seuilHaut] of SEUILS_CANNY) {
      const aretes = new cv.Mat();
      const dilatees = new cv.Mat();
      mats.push(aretes, dilatees);
      cv.Canny(flou, aretes, seuilBas, seuilHaut);
      // Contours épaissis : tolère quelques pixels d'écart entre le quad et le vrai bord.
      cv.dilate(aretes, dilatees, noyau);
      cv.morphologyEx(aretes, aretes, cv.MORPH_CLOSE, noyau);
      if (seuilBas === 25) epais = dilatees;
      const c = meilleurDeCarte(cv, aretes, dilatees, w, h, mats);
      if (c) candidats.push(c);
    }

    // 2. Otsu : feuille claire sur fond plus sombre, puis l'inverse.
    for (const type of [cv.THRESH_BINARY, cv.THRESH_BINARY_INV]) {
      const masque = new cv.Mat();
      mats.push(masque);
      cv.threshold(flou, masque, 0, 255, type + cv.THRESH_OTSU);
      cv.morphologyEx(masque, masque, cv.MORPH_CLOSE, noyau);
      cv.morphologyEx(masque, masque, cv.MORPH_OPEN, noyau);
      const c = meilleurDeCarte(cv, masque, epais!, w, h, mats);
      if (c) candidats.push(c);
    }

    if (candidats.length === 0) return null;
    candidats.sort((a, b) => b.score - a.score);
    return mettreAEchelle(candidats[0].quad, 1 / echelle);
  } finally {
    for (const m of mats) {
      try { m.delete(); } catch { /* déjà libérée */ }
    }
  }
}

/**
 * Redresse la perspective (interpolation bicubique). Renvoie null si le quad est
 * invalide ; l'appelant retombe alors sur l'ancien redressement.
 */
export function redresserCv(cv: Cv, source: ImageDataLike, quad: Quad, largeur: number, hauteur: number): ImageDataLike | null {
  if (!quadValide(quad)) return null;
  const mats: Mats = [];
  try {
    const src = new cv.Mat(source.height, source.width, cv.CV_8UC4);
    mats.push(src);
    src.data.set(source.data);
    const pts = (p: Point[]) => cv.matFromArray(4, 1, cv.CV_32FC2, p.flatMap((q) => [q.x, q.y]));
    const de = pts(quad);
    const vers = pts([{ x: 0, y: 0 }, { x: largeur, y: 0 }, { x: largeur, y: hauteur }, { x: 0, y: hauteur }]);
    mats.push(de, vers);
    const M = cv.getPerspectiveTransform(de, vers);
    mats.push(M);
    const dst = new cv.Mat();
    mats.push(dst);
    cv.warpPerspective(src, dst, M, new cv.Size(largeur, hauteur), cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
    return { data: new Uint8ClampedArray(dst.data), width: dst.cols, height: dst.rows };
  } finally {
    for (const m of mats) {
      try { m.delete(); } catch { /* déjà libérée */ }
    }
  }
}
