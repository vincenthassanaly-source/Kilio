// Traits manuscrits de « Vider ma tête » : format de stockage (JSON), nettoyage
// des points saisis au stylet, gomme par trait et validation côté serveur.
//
// Coordonnées LOGIQUES : la largeur de la feuille vaut toujours LARGEUR_LOGIQUE,
// quelle que soit la taille de l'écran ; le canvas applique l'échelle au dessin.
// Un trait est { e: épaisseur, p: [x, y, pression, x, y, pression, ...] } avec
// x, y entiers et pression entière de 0 à 100 (0,5 = souris, sans pression).

export const LARGEUR_LOGIQUE = 1000;
export const HAUTEUR_MIN = 2000;
const HAUTEUR_MAX = 30_000;
export const MAX_TRAITS = 3000;
export const MAX_POINTS_PAR_TRAIT = 2000;
const MAX_POINTS_TOTAL = 150_000;

export type Epaisseur = 1 | 2 | 3;
export const EPAISSEURS: readonly Epaisseur[] = [1, 2, 3];

/** Largeur de base du trait, en unités logiques, par épaisseur. */
const LARGEUR_BASE: Record<Epaisseur, number> = { 1: 2.5, 2: 4.5, 3: 8 };

export type Trait = { e: Epaisseur; p: number[] };
export type PointBrut = { x: number; y: number; pression: number };

/** Largeur logique d'un point : la pression module de 60 % à 140 % la largeur de base. */
export function largeurPoint(e: Epaisseur, pression: number): number {
  return LARGEUR_BASE[e] * (0.6 + (0.8 * pression) / 100);
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Distance du point (px, py) au segment (ax, ay)-(bx, by). */
function distanceSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const longueur2 = dx * dx + dy * dy;
  const t = longueur2 === 0 ? 0 : borner(((px - ax) * dx + (py - ay) * dy) / longueur2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Douglas-Peucker sur des points [x, y, pression] : retire les points qui
 * s'écartent de moins de `tolerance` de la corde, extrémités conservées.
 * Itératif (pas de récursion) pour supporter les traits les plus longs.
 */
export function simplifier(p: number[], tolerance: number): number[] {
  const n = p.length / 3;
  if (n <= 2) return p;
  const garde = new Array<boolean>(n).fill(false);
  garde[0] = true;
  garde[n - 1] = true;
  const pile: Array<[number, number]> = [[0, n - 1]];
  while (pile.length > 0) {
    const [debut, fin] = pile.pop()!;
    let maxDistance = 0;
    let indice = -1;
    for (let i = debut + 1; i < fin; i++) {
      const d = distanceSegment(p[i * 3], p[i * 3 + 1], p[debut * 3], p[debut * 3 + 1], p[fin * 3], p[fin * 3 + 1]);
      if (d > maxDistance) {
        maxDistance = d;
        indice = i;
      }
    }
    if (indice !== -1 && maxDistance > tolerance) {
      garde[indice] = true;
      pile.push([debut, indice], [indice, fin]);
    }
  }
  const resultat: number[] = [];
  for (let i = 0; i < n; i++) if (garde[i]) resultat.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  return resultat;
}

/**
 * Transforme les points saisis (pression de 0 à 1) en trait stockable :
 * arrondi, pression bornée, doublons consécutifs retirés, simplification.
 * Un point isolé est dupliqué pour qu'un simple tap laisse un point visible.
 */
export function creerTrait(e: Epaisseur, points: PointBrut[]): Trait {
  const p: number[] = [];
  for (const point of points) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    const n = p.length;
    if (n >= 3 && p[n - 3] === x && p[n - 2] === y) continue;
    p.push(x, y, borner(Math.round(point.pression * 100), 0, 100));
  }
  if (p.length === 3) p.push(p[0], p[1], p[2]);
  return { e, p: simplifier(p, 1.5) };
}

/** Indices des traits à moins de `rayon` du point (x, y), épaisseur du trait comprise. */
export function traitsTouches(traits: Trait[], x: number, y: number, rayon: number): number[] {
  const touches: number[] = [];
  traits.forEach((trait, indice) => {
    const seuil = rayon + LARGEUR_BASE[trait.e] / 2;
    const { p } = trait;
    for (let i = 0; i + 5 < p.length; i += 3) {
      if (distanceSegment(x, y, p[i], p[i + 1], p[i + 3], p[i + 4]) <= seuil) {
        touches.push(indice);
        return;
      }
    }
  });
  return touches;
}

// Étendue verticale [min, max] de chaque trait, calculée une fois (les traits
// ne sont jamais modifiés après création) : le canvas redessine la fenêtre
// visible à chaque défilement, sans reparcourir tous les points.
const etendues = new WeakMap<Trait, [number, number]>();

function etendueY(trait: Trait): [number, number] {
  let e = etendues.get(trait);
  if (!e) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 1; i < trait.p.length; i += 3) {
      min = Math.min(min, trait.p[i]);
      max = Math.max(max, trait.p[i]);
    }
    e = [min, max];
    etendues.set(trait, e);
  }
  return e;
}

/** Le trait (épaisseur comprise) touche-t-il la bande verticale [yMin, yMax] ? */
export function intersecteBande(trait: Trait, yMin: number, yMax: number): boolean {
  const [min, max] = etendueY(trait);
  const marge = LARGEUR_BASE[trait.e];
  return max + marge >= yMin && min - marge <= yMax;
}

/** Place laissée sous le trait le plus bas : la feuille s'agrandit avant que le stylet n'arrive en bas. */
const MARGE_BAS = 1000;
const PAS_HAUTEUR = 500;

/** Hauteur logique nécessaire : toujours au moins HAUTEUR_MIN, et de la place sous le dernier trait. */
export function hauteurRequise(traits: Trait[]): number {
  let maxY = 0;
  for (const { p } of traits) for (let i = 1; i < p.length; i += 3) maxY = Math.max(maxY, p[i]);
  if (maxY === 0) return HAUTEUR_MIN;
  const besoin = Math.ceil((maxY + MARGE_BAS) / PAS_HAUTEUR) * PAS_HAUTEUR;
  return Math.min(HAUTEUR_MAX, Math.max(HAUTEUR_MIN, besoin));
}

/**
 * Une feuille relue de la base (`stockees`, type inconnu) est-elle identique aux
 * traits donnés ? Comparaison valeur par valeur, indépendante de l'ordre des clés
 * (jsonb ne le garantit pas) ; toute donnée illisible compte comme différente.
 */
export function traitsIdentiques(stockees: unknown, traits: Trait[]): boolean {
  if (!Array.isArray(stockees) || stockees.length !== traits.length) return false;
  return traits.every((trait, i) => {
    const s = stockees[i] as { e?: unknown; p?: unknown } | null;
    if (typeof s !== "object" || s === null || s.e !== trait.e || !Array.isArray(s.p)) return false;
    const p: unknown[] = s.p;
    return p.length === trait.p.length && trait.p.every((valeur, j) => p[j] === valeur);
  });
}

export function compterPoints(traits: Trait[]): number {
  return traits.reduce((total, trait) => total + trait.p.length / 3, 0);
}

export type ResultatValidation =
  | { ok: true; traits: Trait[]; hauteur: number }
  | { ok: false; error: string };

const entierDans = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Valide une feuille reçue d'un client (non fiable) et la reconstruit sans champ superflu. */
export function validerFeuille(input: unknown): ResultatValidation {
  const invalide = { ok: false, error: "Feuille invalide." } as const;
  if (typeof input !== "object" || input === null) return invalide;
  const { traits, hauteur } = input as { traits?: unknown; hauteur?: unknown };
  if (!Array.isArray(traits) || traits.length > MAX_TRAITS) return invalide;
  if (!entierDans(hauteur, 1, HAUTEUR_MAX)) return invalide;

  const propres: Trait[] = [];
  let points = 0;
  for (const brut of traits) {
    if (typeof brut !== "object" || brut === null) return invalide;
    const { e, p } = brut as { e?: unknown; p?: unknown };
    if (e !== 1 && e !== 2 && e !== 3) return invalide;
    if (!Array.isArray(p) || p.length < 6 || p.length % 3 !== 0 || p.length > MAX_POINTS_PAR_TRAIT * 3) return invalide;
    for (let i = 0; i < p.length; i += 3) {
      if (!entierDans(p[i], 0, LARGEUR_LOGIQUE) || !entierDans(p[i + 1], 0, HAUTEUR_MAX) || !entierDans(p[i + 2], 0, 100)) {
        return invalide;
      }
    }
    points += p.length / 3;
    if (points > MAX_POINTS_TOTAL) return invalide;
    propres.push({ e, p: p as number[] });
  }
  return { ok: true, traits: propres, hauteur };
}
