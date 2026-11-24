// Géométrie du scanner : quadrilatère de la feuille, ordre des coins et
// redressement de perspective. Fonctions pures (aucun accès au DOM) : elles
// travaillent sur des tampons RGBA (`ImageDataLike`), donc testables sous
// Vitest sans canvas.

export type Point = { x: number; y: number };

/** Quatre coins dans l'ordre : haut-gauche, haut-droit, bas-droit, bas-gauche. */
export type Quad = [Point, Point, Point, Point];

/** Sous-ensemble d'`ImageData` utilisé ici (évite de dépendre du DOM). */
export type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/** Plus grand côté d'une page redressée : borne la mémoire sur mobile. */
const COTE_MAX_REDRESSE_PX = 2000;
/** Plus petit côté accepté pour une page redressée. */
const COTE_MIN_REDRESSE_PX = 32;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Remet quatre points quelconques dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche :
 * tri par angle autour du barycentre (sens des aiguilles d'une montre à l'écran, y vers le bas),
 * puis départ au coin qui minimise x+y (à égalité, le plus haut). Contrairement à un tri par x+y
 * et x−y, un rectangle tourné de 45° pile garde 4 coins distincts.
 */
export function ordonnerCoins(points: Point[]): Quad {
  if (points.length !== 4) throw new Error("ordonnerCoins attend exactement 4 points");
  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4;
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4;
  const tries = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let depart = 0;
  for (let i = 1; i < 4; i++) {
    const p = tries[i];
    const m = tries[depart];
    const ecart = p.x + p.y - (m.x + m.y);
    if (ecart < -1e-9 || (Math.abs(ecart) <= 1e-9 && p.y < m.y)) depart = i;
  }
  return [tries[depart], tries[(depart + 1) % 4], tries[(depart + 2) % 4], tries[(depart + 3) % 4]];
}

/** Cadre par défaut : toute l'image avec une petite marge. */
export function quadParDefaut(largeur: number, hauteur: number, marge = 0.06): Quad {
  const mx = largeur * marge;
  const my = hauteur * marge;
  return [
    { x: mx, y: my },
    { x: largeur - mx, y: my },
    { x: largeur - mx, y: hauteur - my },
    { x: mx, y: hauteur - my },
  ];
}

/** Ramène chaque coin dans l'image (le doigt peut sortir du cadre). */
export function bornerQuad(quad: Quad, largeur: number, hauteur: number): Quad {
  const born = (p: Point): Point => ({
    x: Math.min(Math.max(p.x, 0), largeur),
    y: Math.min(Math.max(p.y, 0), hauteur),
  });
  return [born(quad[0]), born(quad[1]), born(quad[2]), born(quad[3])];
}

/** Aire (formule de Gauss) d'un polygone ; toujours positive. */
export function aireQuad(quad: Quad): number {
  let somme = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    somme += a.x * b.y - b.x * a.y;
  }
  return Math.abs(somme) / 2;
}

/**
 * Un quadrilatère est exploitable s'il est convexe et d'aire non nulle :
 * sinon le redressement produirait une image tordue ou vide.
 */
export function quadValide(quad: Quad): boolean {
  let signe = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const croix = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (croix === 0) return false;
    const s = Math.sign(croix);
    if (signe === 0) signe = s;
    else if (s !== signe) return false;
  }
  return aireQuad(quad) > 1;
}

/**
 * Formats aimantés (largeur / hauteur, en portrait) : A4, Lettre US, carte au format ID-1
 * (85,6 × 54 mm). Un rapport estimé à moins de `AIMANTATION` près devient exactement celui du format.
 */
const FORMATS = [210 / 297, 8.5 / 11, 54 / 85.6];
const AIMANTATION = 0.03;
/** Focale par défaut (part du plus grand côté de la photo) quand les 4 coins ne permettent pas de l'estimer. */
const FOCALE_DEFAUT = 0.8;
/**
 * Focales plausibles (part du plus grand côté de la photo) : un téléphone va du grand-angle (≈ 0,6)
 * au téléobjectif ×2 (≈ 1,6). Hors de cette plage, le quadrilatère n'est pas l'image d'un rectangle
 * (coins posés à la main au hasard).
 */
const FOCALE_MIN = 0.5;
const FOCALE_MAX = 2;
/**
 * Écart maximal (facteur) entre le rapport estimé et celui des plus grands côtés : même à 35°
 * d'inclinaison la perspective ne fausse ce dernier que d'un facteur 1,46. Au-delà, l'estimation est
 * jugée instable et l'ancien calcul est gardé.
 */
const ECART_RAPPORT_MAX = 1.6;

type Vec3 = [number, number, number];
const vectoriel = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scalaire = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Rapport largeur/hauteur réel du rectangle dont `quad` est l'image en perspective (Zhang et He,
 * « Whiteboard scanning and image enhancement », 2007), centre optique au milieu de la photo. La
 * focale est estimée depuis les 4 coins ; si elle ne l'est pas (un couple de côtés parallèles à
 * l'image), on prend une focale par défaut. Renvoie null si le quadrilatère n'est pas projectif
 * (focale estimée aberrante, coins dégénérés) : l'appelant garde alors l'ancien calcul.
 */
export function rapportReel(quad: Quad, largeurImage: number, hauteurImage: number): number | null {
  const [hg, hd, bd, bg] = quad;
  const u0 = largeurImage / 2;
  const v0 = hauteurImage / 2;
  const cote = Math.max(largeurImage, hauteurImage);
  const m1: Vec3 = [hg.x, hg.y, 1];
  const m2: Vec3 = [hd.x, hd.y, 1];
  const m3: Vec3 = [bg.x, bg.y, 1];
  const m4: Vec3 = [bd.x, bd.y, 1];
  const d2 = scalaire(vectoriel(m2, m4), m3);
  const d3 = scalaire(vectoriel(m3, m4), m2);
  if (Math.abs(d2) < 1e-9 || Math.abs(d3) < 1e-9) return null;
  const k2 = scalaire(vectoriel(m1, m4), m3) / d2;
  const k3 = scalaire(vectoriel(m1, m4), m2) / d3;
  if (!(k2 > 0) || !(k3 > 0)) return null;
  const n2 = m2.map((v, i) => k2 * v - m1[i]) as Vec3;
  const n3 = m3.map((v, i) => k3 * v - m1[i]) as Vec3;
  let f = FOCALE_DEFAUT * cote;
  // n2[2] ou n3[2] nul : ce couple de côtés est parallèle dans l'image, la focale n'est pas mesurable.
  if (Math.abs(n2[2]) > 1e-6 && Math.abs(n3[2]) > 1e-6) {
    const f2 =
      -(
        n2[0] * n3[0] - (n2[0] * n3[2] + n2[2] * n3[0]) * u0 + n2[2] * n3[2] * u0 * u0 +
        (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * v0 + n2[2] * n3[2] * v0 * v0)
      ) / (n2[2] * n3[2]);
    // Perspective trop faible pour mesurer la focale (quasi de face) : la focale par défaut suffit,
    // le rapport n'en dépend presque pas. Sinon une focale aberrante trahit un quadrilatère non projectif.
    const mesurable = Math.abs(n2[2]) * cote > 0.02 * Math.hypot(n2[0], n2[1]) || Math.abs(n3[2]) * cote > 0.02 * Math.hypot(n3[0], n3[1]);
    if (mesurable) {
      if (!(f2 > 0)) return null;
      f = Math.sqrt(f2);
      if (f < FOCALE_MIN * cote || f > FOCALE_MAX * cote) return null;
    }
  }
  const norme = (n: Vec3) => {
    const a = (n[0] - u0 * n[2]) / f;
    const b = (n[1] - v0 * n[2]) / f;
    return a * a + b * b + n[2] * n[2];
  };
  const rapport = Math.sqrt(norme(n2) / norme(n3));
  return Number.isFinite(rapport) && rapport > 0 ? rapport : null;
}

/** Aimante un rapport largeur/hauteur au format connu le plus proche (portrait ou paysage), à 3 % près. */
export function aimanterRapport(rapport: number): number {
  for (const f of FORMATS) {
    for (const cible of [f, 1 / f]) if (Math.abs(rapport / cible - 1) <= AIMANTATION) return cible;
  }
  return rapport;
}

/**
 * Taille de la page redressée, bornée. Sans la taille de la photo : plus grands côtés opposés. Avec
 * elle : rapport largeur/hauteur réel estimé depuis les 4 coins (la perspective allonge le côté proche
 * et raccourcit le côté fuyant), aimanté à A4, Lettre US ou carte, et le plus grand côté mesuré comme
 * échelle ; repli sur le premier calcul si le quadrilatère n'est pas projectif ou si l'estimation
 * s'écarte trop du premier calcul (instable).
 */
export function tailleSortie(
  quad: Quad,
  coteMax = COTE_MAX_REDRESSE_PX,
  image?: { largeur: number; hauteur: number }
): { largeur: number; hauteur: number } {
  const [hg, hd, bd, bg] = quad;
  let largeur = Math.max(distance(hg, hd), distance(bg, bd));
  let hauteur = Math.max(distance(hg, bg), distance(hd, bd));
  const estime = image ? rapportReel(quad, image.largeur, image.hauteur) : null;
  const rapport = estime && Math.max(estime / (largeur / hauteur), (largeur / hauteur) / estime) <= ECART_RAPPORT_MAX ? estime : null;
  if (rapport) {
    const r = aimanterRapport(rapport);
    const grand = Math.max(largeur, hauteur);
    if (r >= 1) {
      largeur = grand;
      hauteur = grand / r;
    } else {
      hauteur = grand;
      largeur = grand * r;
    }
  }
  const echelle = Math.min(1, coteMax / Math.max(largeur, hauteur, 1));
  largeur *= echelle;
  hauteur *= echelle;
  return {
    largeur: Math.max(COTE_MIN_REDRESSE_PX, Math.round(largeur)),
    hauteur: Math.max(COTE_MIN_REDRESSE_PX, Math.round(hauteur)),
  };
}

/**
 * Résout A·x = b (n×n) par élimination de Gauss avec pivot partiel.
 * Renvoie null si la matrice est singulière.
 */
function resoudre(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((ligne, i) => [...ligne, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

/**
 * Homographie H (3×3, h33 = 1) qui envoie le rectangle de sortie
 * (0,0)-(w,h) sur le quadrilatère source : pour chaque pixel de sortie on
 * calcule où lire dans la source. Renvoie null si le quad est dégénéré.
 */
export function homographie(quad: Quad, largeur: number, hauteur: number): number[] | null {
  const dest: Point[] = [
    { x: 0, y: 0 },
    { x: largeur, y: 0 },
    { x: largeur, y: hauteur },
    { x: 0, y: hauteur },
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dest[i];
    const { x: u, y: v } = quad[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  const h = resoudre(A, b);
  return h ? [...h, 1] : null;
}

/**
 * Redresse la perspective : extrait le quadrilatère `quad` de `source` dans
 * une image rectangulaire `largeur`×`hauteur`, avec échantillonnage bilinéaire.
 * Renvoie null si le quadrilatère est invalide.
 */
export function redresser(
  source: ImageDataLike,
  quad: Quad,
  largeur: number,
  hauteur: number
): ImageDataLike | null {
  if (!quadValide(quad)) return null;
  const H = homographie(quad, largeur, hauteur);
  if (!H) return null;

  const sortie = new Uint8ClampedArray(largeur * hauteur * 4);
  const { data, width: sw, height: sh } = source;
  const maxX = sw - 1;
  const maxY = sh - 1;

  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      // +0,5 : on échantillonne le centre du pixel de sortie.
      const px = x + 0.5;
      const py = y + 0.5;
      const w = H[6] * px + H[7] * py + 1;
      let sx = (H[0] * px + H[1] * py + H[2]) / w - 0.5;
      let sy = (H[3] * px + H[4] * py + H[5]) / w - 0.5;
      sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
      sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 < maxX ? x0 + 1 : x0;
      const y1 = y0 < maxY ? y0 + 1 : y0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * largeur + x) * 4;
      for (let c = 0; c < 4; c++) {
        const haut = data[i00 + c] * (1 - fx) + data[i10 + c] * fx;
        const bas = data[i01 + c] * (1 - fx) + data[i11 + c] * fx;
        sortie[o + c] = haut * (1 - fy) + bas * fy;
      }
    }
  }
  return { data: sortie, width: largeur, height: hauteur };
}

/** Met à l'échelle un quad (ex. coins trouvés sur une miniature → image pleine). */
export function mettreAEchelle(quad: Quad, facteur: number): Quad {
  const f = (p: Point): Point => ({ x: p.x * facteur, y: p.y * facteur });
  return [f(quad[0]), f(quad[1]), f(quad[2]), f(quad[3])];
}
