// Détection des bords d'un document sur une image RGBA (miniature).
//
// Sans OpenCV, mais avec la même idée que les scanners : on cherche des
// *contours* plutôt qu'une zone plus claire que son entourage, ce qui marche
// aussi pour une petite carte, un document sombre ou clair sur table claire.
//
//  1. Contours : gradient (Sobel) sur la luminance ET deux canaux de couleur,
//     affinage (suppression des non-maxima) puis hystérésis.
//  2. Droites : transformée de Hough, où chaque pixel de contour ne vote que
//     pour les droites orientées comme son gradient (beaucoup plus net).
//  3. Quadrilatères : on assemble deux paires de droites quasi parallèles ;
//     chaque candidat est noté par la part de ses 4 côtés réellement appuyée
//     par un contour parallèle (peu importe qu'il soit plus clair ou plus sombre).
//  4. Affinage : chaque côté est reposé par moindres carrés sur ses pixels.
//
// Renvoie null si rien de fiable : l'écran de recadrage propose alors un cadre
// par défaut que l'utilisateur ajuste à la main (avec loupe).

import { aireQuad, bornerQuad, mettreAEchelle, ordonnerCoins, quadValide, type ImageDataLike, type Point, type Quad } from "./geometrie";

/** Côté de travail : assez fin pour les coins, assez petit pour tourner en direct. */
const COTE_DETECTION_PX = 240;

/** Écart minimal de contraste (niveaux de gris par pixel) pour parler de contour. */
const PAS_MIN = 8;
/** Pondération des canaux : luminance, puis deux axes de couleur. */
const POIDS_CANAUX = [1, 0.7, 0.7];
/** Pas angulaire de l'accumulateur de Hough (degrés) et demi-ouverture des votes. */
const PAS_THETA_DEG = 2;
const NB_THETA = 180 / PAS_THETA_DEG;
const OUVERTURE_VOTES = 2;
/** Nombre de droites retenues. */
const NB_DROITES = 28;
/** Score minimal d'un candidat pour être accepté. */
const SCORE_MIN = 0.5;

type Pixel = { x: number; y: number; mag: number; phi: number };
type Droite = { nx: number; ny: number; rho: number; votes: number; theta: number };

type Champ = {
  w: number;
  h: number;
  mag: Float32Array;
  gx: Float32Array;
  gy: Float32Array;
  /** Seuil haut de l'hystérésis, aussi utilisé pour juger l'appui d'un côté. */
  haut: number;
  pixels: Pixel[];
};

/** Flou binomial [1 2 1] séparable, bords répliqués. */
function flou3(src: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const g = x > 0 ? src[i - 1] : src[i];
      const d = x < w - 1 ? src[i + 1] : src[i];
      tmp[i] = (g + 2 * src[i] + d) / 4;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const hh = y > 0 ? tmp[i - w] : tmp[i];
      const b = y < h - 1 ? tmp[i + w] : tmp[i];
      dst[i] = (hh + 2 * tmp[i] + b) / 4;
    }
  }
  return dst;
}

function plansDeCouleur(img: ImageDataLike): Float32Array[] {
  const { data, width: w, height: h } = img;
  const lum = new Float32Array(w * h);
  const c1 = new Float32Array(w * h);
  const c2 = new Float32Array(w * h);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    lum[i] = (77 * r + 150 * g + 29 * b) / 256;
    c1[i] = r - g;
    c2[i] = (r + g) / 2 - b;
  }
  return [lum, c1, c2].map((p) => flou3(flou3(p, w, h), w, h));
}

/** Gradient multi-canaux : en chaque pixel, le canal au contraste pondéré le plus fort. */
function champDeGradient(img: ImageDataLike, fractionHaut: number): Champ {
  const { width: w, height: h } = img;
  const plans = plansDeCouleur(img);
  const mag = new Float32Array(w * h);
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let meilleur = 0;
      for (let k = 0; k < plans.length; k++) {
        const p = plans[k];
        // Sobel / 4 : un saut de contraste Δ donne ici ≈ Δ.
        const sx = (p[i - w + 1] + 2 * p[i + 1] + p[i + w + 1] - p[i - w - 1] - 2 * p[i - 1] - p[i + w - 1]) / 4;
        const sy = (p[i + w - 1] + 2 * p[i + w] + p[i + w + 1] - p[i - w - 1] - 2 * p[i - w] - p[i - w + 1]) / 4;
        const m = Math.hypot(sx, sy) * POIDS_CANAUX[k];
        if (m > meilleur) {
          meilleur = m;
          mag[i] = m;
          gx[i] = sx * POIDS_CANAUX[k];
          gy[i] = sy * POIDS_CANAUX[k];
        }
      }
    }
  }

  // Seuil haut adaptatif : une fraction du 97e centile, sans descendre sous le bruit.
  const positifs = Array.from(mag).filter((m) => m > 0).sort((a, b) => a - b);
  const p97 = positifs.length ? positifs[Math.floor(positifs.length * 0.97)] : 0;
  const haut = Math.max(PAS_MIN, fractionHaut * p97);
  const bas = 0.5 * haut;

  // Suppression des non-maxima le long du gradient.
  const nms = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m < bas) continue;
      const secteur = ((Math.round(Math.atan2(gy[i], gx[i]) / (Math.PI / 4)) % 4) + 4) % 4;
      const dx = secteur === 0 ? 1 : secteur === 3 ? -1 : secteur === 1 ? 1 : 0;
      const dy = secteur === 0 ? 0 : 1;
      const a = mag[i + dy * w + dx];
      const b = mag[i - dy * w - dx];
      if (m >= a && m > b) nms[i] = 1;
    }
  }

  // Hystérésis : on part des contours forts et on suit les faibles voisins.
  const garde = new Uint8Array(w * h);
  const pile: number[] = [];
  for (let i = 0; i < nms.length; i++) {
    if (nms[i] && mag[i] >= haut) {
      garde[i] = 1;
      pile.push(i);
    }
  }
  while (pile.length) {
    const i = pile.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
        const j = yy * w + xx;
        if (nms[j] && !garde[j] && mag[j] >= bas) {
          garde[j] = 1;
          pile.push(j);
        }
      }
    }
  }

  const pixels: Pixel[] = [];
  for (let i = 0; i < garde.length; i++) {
    if (!garde[i]) continue;
    const x = i % w;
    pixels.push({ x: x + 0.5, y: (i - x) / w + 0.5, mag: mag[i], phi: Math.atan2(gy[i], gx[i]) });
  }
  return { w, h, mag, gx, gy, haut, pixels };
}

/** Transformée de Hough guidée par le gradient ; renvoie les meilleures droites. */
function trouverDroites(champ: Champ): Droite[] {
  const { w, h, pixels, haut } = champ;
  const diag = Math.ceil(Math.hypot(w, h));
  const nbRho = 2 * diag + 1;
  const acc = new Float32Array(NB_THETA * nbRho);

  for (const p of pixels) {
    const poids = Math.min(4, p.mag / haut);
    let theta0 = p.phi % Math.PI;
    if (theta0 < 0) theta0 += Math.PI;
    const centre = Math.round(theta0 / ((PAS_THETA_DEG * Math.PI) / 180));
    for (let db = -OUVERTURE_VOTES; db <= OUVERTURE_VOTES; db++) {
      let t = centre + db;
      const theta = (t * PAS_THETA_DEG * Math.PI) / 180;
      let rho = p.x * Math.cos(theta) + p.y * Math.sin(theta);
      if (t < 0) { t += NB_THETA; rho = -rho; }
      if (t >= NB_THETA) { t -= NB_THETA; rho = -rho; }
      const r = Math.round(rho) + diag;
      if (r < 0 || r >= nbRho) continue;
      acc[t * nbRho + r] += poids * (db === 0 ? 1 : 0.7);
    }
  }

  // Maxima locaux (fenêtre ±3 en ρ, ±4 en θ), au-dessus d'un minimum de votes.
  const minVotes = 16;
  const pics: Droite[] = [];
  for (let t = 0; t < NB_THETA; t++) {
    for (let r = 3; r < nbRho - 3; r++) {
      const v = acc[t * nbRho + r];
      if (v < minVotes) continue;
      let max = true;
      for (let dt = -4; dt <= 4 && max; dt++) {
        const tt = (t + dt + NB_THETA) % NB_THETA;
        for (let dr = -3; dr <= 3; dr++) {
          if (dt === 0 && dr === 0) continue;
          const w2 = acc[tt * nbRho + r + dr];
          if (w2 > v || (w2 === v && (dt < 0 || (dt === 0 && dr < 0)))) { max = false; break; }
        }
      }
      if (!max) continue;
      const theta = (t * PAS_THETA_DEG * Math.PI) / 180;
      pics.push({ nx: Math.cos(theta), ny: Math.sin(theta), rho: r - diag, votes: v, theta });
    }
  }
  pics.sort((a, b) => b.votes - a.votes);
  return pics.slice(0, NB_DROITES);
}

/** Repose une droite par moindres carrés sur les pixels de contour qui la suivent. */
function affinerDroite(d: Droite, pixels: Pixel[]): Droite {
  let courante = d;
  for (let tour = 0; tour < 2; tour++) {
    let n = 0, sx = 0, sy = 0;
    const retenus: Pixel[] = [];
    for (const p of pixels) {
      if (Math.abs(p.x * courante.nx + p.y * courante.ny - courante.rho) > 3) continue;
      // Gradient aligné avec la normale de la droite (dans un sens ou dans l'autre).
      if (Math.abs(Math.cos(p.phi) * courante.nx + Math.sin(p.phi) * courante.ny) < 0.8) continue;
      retenus.push(p);
      sx += p.x; sy += p.y; n++;
    }
    if (n < 8) break;
    const cx = sx / n, cy = sy / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of retenus) {
      const ax = p.x - cx, ay = p.y - cy;
      sxx += ax * ax; sxy += ax * ay; syy += ay * ay;
    }
    // Direction principale du nuage ; la normale lui est perpendiculaire.
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let nx = -Math.sin(angle), ny = Math.cos(angle);
    if (nx * courante.nx + ny * courante.ny < 0) { nx = -nx; ny = -ny; }
    courante = { ...courante, nx, ny, rho: cx * nx + cy * ny, theta: Math.atan2(ny, nx) };
  }
  return courante;
}

function intersection(a: Droite, b: Droite): Point | null {
  const det = a.nx * b.ny - a.ny * b.nx;
  if (Math.abs(det) < 1e-6) return null;
  return { x: (a.rho * b.ny - b.rho * a.ny) / det, y: (a.nx * b.rho - b.nx * a.rho) / det };
}

/** Écart d'orientation entre deux droites, dans [0, 90°] (en radians). */
function ecartAngle(a: Droite, b: Droite): number {
  const d = Math.abs(Math.atan2(Math.sin(a.theta - b.theta), Math.cos(a.theta - b.theta)));
  return Math.min(d, Math.PI - d);
}

/** Part d'un côté appuyée par un contour parallèle, et le sens (signe) du contraste. */
function appuiDuCote(champ: Champ, p: Point, q: Point, sortant: Point): { part: number; signe: number } {
  const { w, h, gx, gy, haut } = champ;
  const dx = q.x - p.x, dy = q.y - p.y;
  const longueur = Math.hypot(dx, dy);
  if (longueur < 1) return { part: 0, signe: 0 };
  const nx = sortant.x, ny = sortant.y;
  const seuil = 0.5 * haut;
  const n = Math.max(4, Math.floor(longueur));
  let compte = 0, plus = 0, moins = 0, exclus = 0;
  for (let k = 0; k < n; k++) {
    const t = 0.08 + (0.84 * (k + 0.5)) / n;
    const x = p.x + dx * t, y = p.y + dy * t;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) { exclus++; continue; }
    compte++;
    let meilleur = 0;
    for (const off of [-1.5, -0.75, 0, 0.75, 1.5]) {
      const xi = Math.round(x + nx * off - 0.5), yi = Math.round(y + ny * off - 0.5);
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue;
      const proj = gx[yi * w + xi] * nx + gy[yi * w + xi] * ny;
      if (Math.abs(proj) > Math.abs(meilleur)) meilleur = proj;
    }
    if (Math.abs(meilleur) >= seuil) {
      if (meilleur > 0) plus++; else moins++;
    }
  }
  // Un côté qui sort presque entièrement de l'image : neutre (document coupé).
  if (compte === 0 || exclus > 0.6 * (compte + exclus)) return { part: 0.5, signe: 0 };
  // L'appui compte un contour quel que soit son sens (un bandeau sombre inverse le
  // contraste sur une partie du côté) ; le sens ne sert qu'au bonus de cohérence.
  const total = plus + moins;
  const homogene = total > 0 && Math.max(plus, moins) >= 0.8 * total;
  return { part: total / compte, signe: homogene ? (plus >= moins ? 1 : -1) : 0 };
}

type Candidat = { quad: Quad; score: number; aire: number };

function noterQuadrilatere(champ: Champ, quad: Quad): Candidat | null {
  const { w, h } = champ;
  if (!quadValide(quad)) return null;
  const centre = { x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4, y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4 };
  const parts: number[] = [];
  const signes: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = quad[i], q = quad[(i + 1) % 4];
    const dx = q.x - p.x, dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    let nx = dy / l, ny = -dx / l;
    // Normale tournée vers l'extérieur.
    const milieu = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    if ((milieu.x - centre.x) * nx + (milieu.y - centre.y) * ny < 0) { nx = -nx; ny = -ny; }
    const { part, signe } = appuiDuCote(champ, p, q, { x: nx, y: ny });
    if (part < 0.2) return null; // un côté sans contour : candidat écarté vite
    parts.push(part);
    signes.push(signe);
  }
  const moyenne = parts.reduce((a, b) => a + b, 0) / 4;
  const minimum = Math.min(...parts);
  let score = 0.5 * moyenne + 0.5 * minimum;
  // Bonus si tous les côtés ont le même sens de contraste (document plus clair OU plus sombre).
  const nonNuls = signes.filter((s) => s !== 0);
  // Léger : une carte à bandeau sombre a légitimement des sens de contraste mixtes.
  if (nonNuls.length >= 3 && nonNuls.every((s) => s === nonNuls[0])) score *= 1.04;
  const aire = aireQuad(quad);
  const part = aire / (w * h);
  score *= 0.7 + 0.3 * Math.min(1, Math.sqrt(part) / 0.5);
  return { quad, score, aire };
}

/** Angle intérieur (degrés) au sommet b du triangle a-b-c. */
function angleAuSommet(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const cos = (v1x * v2x + v1y * v2y) / ((Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

function quadPlausible(quad: Quad, w: number, h: number): boolean {
  const diag = Math.hypot(w, h);
  const marge = 0.05;
  for (const p of quad) {
    if (p.x < -w * marge || p.x > w * (1 + marge) || p.y < -h * marge || p.y > h * (1 + marge)) return false;
  }
  for (let i = 0; i < 4; i++) {
    const cote = Math.hypot(quad[(i + 1) % 4].x - quad[i].x, quad[(i + 1) % 4].y - quad[i].y);
    if (cote < 0.07 * diag || cote > 1.25 * diag) return false;
    const ang = angleAuSommet(quad[(i + 3) % 4], quad[i], quad[(i + 1) % 4]);
    if (ang < 50 || ang > 130) return false;
  }
  return true;
}

/**
 * Fractions du 97e centile de contraste servant de seuil haut, de la plus
 * stricte à la plus souple. Les traits d'encre (contraste ~200) peuvent fixer
 * un seuil trop haut pour le bord d'une feuille blanche sur table claire
 * (contraste ~30) : on retente alors avec un seuil bas.
 */
const FRACTIONS_SEUIL = [0.35, 0.12];

/**
 * Cherche le document dans `img` (idéalement ≤ COTE_DETECTION_PX de côté).
 * Renvoie les 4 coins ordonnés, en pixels de `img`, ou null si rien de fiable.
 */
export function detecterQuadrilatere(img: ImageDataLike): Quad | null {
  if (img.width < 16 || img.height < 16) return null;
  for (const fraction of FRACTIONS_SEUIL) {
    const quad = chercherQuadrilatere(img, fraction);
    if (quad) return quad;
  }
  return null;
}

function chercherQuadrilatere(img: ImageDataLike, fractionHaut: number): Quad | null {
  const { width: w, height: h } = img;
  const champ = champDeGradient(img, fractionHaut);
  if (champ.pixels.length < 20) return null;

  const droites = trouverDroites(champ);
  if (droites.length < 4) return null;
  const diag = Math.hypot(w, h);

  // Paires de droites quasi parallèles et assez éloignées l'une de l'autre.
  const paires: { a: number; b: number; theta: number }[] = [];
  for (let i = 0; i < droites.length; i++) {
    for (let j = i + 1; j < droites.length; j++) {
      const di = droites[i], dj = droites[j];
      if (ecartAngle(di, dj) > (32 * Math.PI) / 180) continue;
      // Distance de la droite j (son point le plus proche de l'origine) à la droite i.
      const sep = Math.abs((dj.rho * dj.nx) * di.nx + (dj.rho * dj.ny) * di.ny - di.rho);
      if (sep < 0.07 * diag) continue;
      // Orientation moyenne modulo 180° : on moyenne les angles doublés (2° et 178° donnent ≈ 0°, pas 90°).
      const theta = Math.atan2(Math.sin(2 * di.theta) + Math.sin(2 * dj.theta), Math.cos(2 * di.theta) + Math.cos(2 * dj.theta)) / 2;
      paires.push({ a: i, b: j, theta });
    }
  }

  let meilleurs: Candidat[] = [];
  for (let i = 0; i < paires.length; i++) {
    for (let j = i + 1; j < paires.length; j++) {
      const A = paires[i], B = paires[j];
      if (A.a === B.a || A.a === B.b || A.b === B.a || A.b === B.b) continue;
      const dt = Math.abs(Math.atan2(Math.sin(2 * (A.theta - B.theta)), Math.cos(2 * (A.theta - B.theta)))) / 2;
      if (dt < (50 * Math.PI) / 180) continue; // les deux paires doivent être bien croisées
      const a1 = droites[A.a], a2 = droites[A.b], b1 = droites[B.a], b2 = droites[B.b];
      const coins = [intersection(a1, b1), intersection(a1, b2), intersection(a2, b2), intersection(a2, b1)];
      if (coins.some((c) => c === null)) continue;
      const quad = ordonnerCoins(coins as Point[]);
      if (!quadPlausible(quad, w, h)) continue;
      const cand = noterQuadrilatere(champ, quad);
      if (cand) meilleurs.push(cand);
    }
  }
  if (!meilleurs.length) return null;

  meilleurs.sort((a, b) => b.score - a.score);
  const top = meilleurs[0].score;
  if (top < SCORE_MIN) return null;
  // Parmi les candidats presque aussi bons, on prend le plus grand : cela préfère le
  // contour extérieur d'une carte à un rectangle intérieur (photo, bloc de texte).
  meilleurs = meilleurs.filter((c) => c.score >= 0.9 * top);
  meilleurs.sort((a, b) => b.aire - a.aire);
  const retenu = meilleurs[0];

  // Affinage : on repose chaque côté sur ses pixels de contour, puis on réintersecte.
  const lignes = retenu.quad.map((p, i) => {
    const q = retenu.quad[(i + 1) % 4];
    const dx = q.x - p.x, dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = dy / l, ny = -dx / l;
    const droite: Droite = { nx, ny, rho: p.x * nx + p.y * ny, votes: 0, theta: Math.atan2(ny, nx) };
    return affinerDroite(droite, champ.pixels);
  });
  const affines = [intersection(lignes[3], lignes[0]), intersection(lignes[0], lignes[1]), intersection(lignes[1], lignes[2]), intersection(lignes[2], lignes[3])];
  if (affines.some((c) => c === null)) return bornerQuad(retenu.quad, w, h);
  const quadAffine = ordonnerCoins(affines as Point[]);
  if (!quadPlausible(quadAffine, w, h)) return bornerQuad(retenu.quad, w, h);
  return bornerQuad(quadAffine, w, h);
}

/**
 * Réduit une image à `COTE_DETECTION_PX` par moyenne de blocs (sans canvas) :
 * contrairement au simple sous-échantillonnage, cela garde les bords nets et
 * sans escaliers. Renvoie l'image réduite et le facteur d'agrandissement.
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
  const fx = width / w;
  const fy = height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor((y + 1) * fy)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor((x + 1) * fx)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const s = (yy * width + xx) * 4;
          r += data[s]; g += data[s + 1]; b += data[s + 2]; n++;
        }
      }
      const o = (y * w + x) * 4;
      sortie[o] = r / n;
      sortie[o + 1] = g / n;
      sortie[o + 2] = b / n;
      sortie[o + 3] = 255;
    }
  }
  return { image: { data: sortie, width: w, height: h }, facteur: fx };
}

/** Détection complète sur une image de n'importe quelle taille (coins en pixels de `img`). */
export function detecterFeuille(img: ImageDataLike): Quad | null {
  const { image, facteur } = reduirePourDetection(img);
  const quad = detecterQuadrilatere(image);
  return quad ? mettreAEchelle(quad, facteur) : null;
}
