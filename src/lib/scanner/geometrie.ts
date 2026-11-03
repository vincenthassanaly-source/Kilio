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
 * Remet quatre points quelconques dans l'ordre haut-gauche, haut-droit,
 * bas-droit, bas-gauche : le coin haut-gauche minimise x+y, le bas-droit le
 * maximise ; le haut-droit maximise x−y, le bas-gauche le minimise.
 */
export function ordonnerCoins(points: Point[]): Quad {
  if (points.length !== 4) throw new Error("ordonnerCoins attend exactement 4 points");
  const parSomme = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const parDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y));
  const hg = parSomme[0];
  const bd = parSomme[3];
  const bg = parDiff[0];
  const hd = parDiff[3];
  return [hg, hd, bd, bg];
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

/** Taille de la page redressée : plus grands côtés opposés, bornée. */
export function tailleSortie(quad: Quad, coteMax = COTE_MAX_REDRESSE_PX): { largeur: number; hauteur: number } {
  const [hg, hd, bd, bg] = quad;
  let largeur = Math.max(distance(hg, hd), distance(bg, bd));
  let hauteur = Math.max(distance(hg, bg), distance(hd, bd));
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
function homographie(quad: Quad, largeur: number, hauteur: number): number[] | null {
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
