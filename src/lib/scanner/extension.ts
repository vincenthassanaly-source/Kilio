// Extension du cadre détecté jusqu'au vrai bord de la feuille. Pur, sans DOM.
//
// Problème : quand la page déborde presque du cadre de la photo (feuille posée à plat,
// photographiée de près), les détecteurs de contours ignorent son vrai contour (3 coins ou
// plus sur le bord de l'image = « on a trouvé le cadre, pas la feuille ») et s'accrochent à
// un détail intérieur : un pli, un bloc de texte. Le cadre rendu est alors une sous-partie
// de la page.
//
// Remède : à partir du cadre trouvé, on pousse chaque côté vers l'extérieur tant que la
// bande juste derrière a la couleur et la clarté du papier. On s'arrête sur le fond (table,
// tissu) ou sur le bord de l'image. Un cadre déjà posé sur le vrai bord ne bouge pas : la
// première bande derrière lui n'est pas du papier.

import { reduirePourDetection } from "./detection";
import { aireQuad, mettreAEchelle, quadValide, type ImageDataLike, type Point, type Quad } from "./geometrie";

/** Plus grand côté de l'image d'analyse (pixels) : assez fin pour un bord net, très rapide. */
const COTE_ANALYSE_PX = 400;
/** Part minimale de l'image que le cadre doit couvrir : une petite carte sur une table claire ne s'étend pas. */
const AIRE_MIN = 0.25;
/** Points testés le long d'un côté (on ignore les 12 % de chaque extrémité, près des coins). */
const ECHANTILLONS = 28;
const DEBUT_COTE = 0.12;
const FIN_COTE = 0.88;
/** Une bande est du papier si sa luminance médiane atteint cette part de celle du papier… */
const TOLERANCE_LUMINANCE = 0.9;
/** …et si sa couleur médiane reste à cette distance RVB (0-255) du papier. */
const TOLERANCE_COULEUR = 32;
/** Bandes non papier consécutives tolérées : saute un pli ou un trait d'encre de quelques pixels. */
const ECARTS_TOLERES = 3;
/** Déplacement minimal (pixels d'analyse) en deçà duquel un côté reste où il est. */
const DEPLACEMENT_MIN = 3;
/**
 * Un côté « s'appuie sur un bord » si, sur cette part au moins des points mesurés, l'intérieur et
 * l'extérieur diffèrent d'au moins `BORD_ECART_LUMINANCE` en luminance ou `BORD_ECART_COULEUR` en couleur.
 */
const BORD_PART_MIN = 0.6;
const BORD_ECART_LUMINANCE = 5;
const BORD_ECART_COULEUR = 10;
/** Profondeur (pixels d'analyse) des bandes comparées de part et d'autre d'un côté. */
const BORD_PROFONDEUR = 3;
/**
 * Épaisseur maximale (pixels d'analyse) d'un trait sombre juste derrière le côté (ligne de texte,
 * cadre imprimé d'un formulaire) au-delà duquel le même papier réapparaît : ce n'est alors pas le
 * bord de la page, et l'extension continue derrière le trait.
 */
const TRAIT_MAX = 10;

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) / 256;
const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  return t[t.length >> 1];
};

export type Rvb = [number, number, number];

function dansConvexe(quad: Quad, x: number, y: number): boolean {
  let signe = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (c === 0) continue;
    if (signe === 0) signe = Math.sign(c);
    else if (Math.sign(c) !== signe) return false;
  }
  return true;
}

/** Couleur et luminance du papier : moyenne des 30 % de pixels les plus clairs à l'intérieur du cadre. */
export function referencePapier(img: ImageDataLike, quad: Quad): { rvb: Rvb; lum: number } | null {
  const { data, width: w, height: h } = img;
  const pas = Math.max(1, Math.floor(Math.sqrt((w * h) / 6000)));
  const pixels: { l: number; r: number; g: number; b: number }[] = [];
  for (let y = 0; y < h; y += pas) {
    for (let x = 0; x < w; x += pas) {
      if (!dansConvexe(quad, x, y)) continue;
      const i = (y * w + x) * 4;
      pixels.push({ l: luma(data[i], data[i + 1], data[i + 2]), r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  }
  if (pixels.length < 20) return null;
  pixels.sort((p, q) => q.l - p.l);
  const clairs = pixels.slice(0, Math.max(10, Math.floor(pixels.length * 0.3)));
  const moy = (f: (p: (typeof clairs)[number]) => number) => clairs.reduce((s, p) => s + f(p), 0) / clairs.length;
  const rvb: Rvb = [moy((p) => p.r), moy((p) => p.g), moy((p) => p.b)];
  return { rvb, lum: luma(...rvb) };
}

type Etat = "papier" | "autre" | "dehors";

/** Nature de la bande parallèle au côté a→b, décalée de `k` pixels vers l'extérieur (normale n). */
function bande(img: ImageDataLike, a: Point, b: Point, n: Point, k: number, ref: { rvb: Rvb; lum: number }): Etat {
  const { data, width: w, height: h } = img;
  const lums: number[] = [];
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  let dedans = 0;
  for (let s = 0; s < ECHANTILLONS; s++) {
    const t = DEBUT_COTE + ((FIN_COTE - DEBUT_COTE) * (s + 0.5)) / ECHANTILLONS;
    for (const dk of [-1, 0, 1]) {
      const x = Math.round(a.x + (b.x - a.x) * t + n.x * (k + dk));
      const y = Math.round(a.y + (b.y - a.y) * t + n.y * (k + dk));
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      lums.push(luma(data[i], data[i + 1], data[i + 2]));
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
      dedans++;
    }
  }
  if (dedans < (ECHANTILLONS * 3) / 2) return "dehors";
  const dist = Math.hypot(mediane(rs) - ref.rvb[0], mediane(gs) - ref.rvb[1], mediane(bs) - ref.rvb[2]);
  return mediane(lums) >= TOLERANCE_LUMINANCE * ref.lum && dist <= TOLERANCE_COULEUR ? "papier" : "autre";
}

/**
 * Couleur moyenne d'une bande de `BORD_PROFONDEUR` pixels le long de la normale (sens `signe`), de
 * k+2 à k+1+BORD_PROFONDEUR : on saute le pixel du bord, où l'ombre de contact dessine souvent un
 * trait plus sombre que le papier comme que la table.
 */
function moyenneBande(img: ImageDataLike, x: number, y: number, n: Point, k: number, signe: 1 | -1): Rvb | null {
  const { data, width: w, height: h } = img;
  let r = 0, g = 0, b = 0, c = 0;
  for (let j = 2; j <= BORD_PROFONDEUR + 1; j++) {
    const px = Math.round(x + n.x * (k + signe * j));
    const py = Math.round(y + n.y * (k + signe * j));
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const i = (py * w + px) * 4;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; c++;
  }
  return c ? [r / c, g / c, b / c] : null;
}

/**
 * Vrai si la droite parallèle au côté a→b, décalée de `k` pixels vers l'extérieur, longe un vrai
 * bord : sur la plupart des points, du papier à l'intérieur et autre chose juste derrière. Un bloc
 * de texte ou un pli ne passe pas, le bord du papier passe, même sur une table presque aussi claire
 * que lui.
 */
function longeUnBord(img: ImageDataLike, a: Point, b: Point, n: Point, k: number, ref: { rvb: Rvb; lum: number }): boolean {
  let mesures = 0;
  let contrastes = 0;
  for (let s = 0; s < ECHANTILLONS; s++) {
    const t = DEBUT_COTE + ((FIN_COTE - DEBUT_COTE) * (s + 0.5)) / ECHANTILLONS;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    // Le côté peut être à un ou deux pixels du vrai bord : on garde le meilleur contraste à ±2 px.
    let vu = false;
    let contraste = false;
    for (let o = -2; o <= 2 && !contraste; o++) {
      const dedans = moyenneBande(img, x, y, n, k + o, -1);
      const dehors = moyenneBande(img, x, y, n, k + o, 1);
      if (!dedans || !dehors) continue;
      vu = true;
      const ecartL = Math.abs(luma(...dedans) - luma(...dehors));
      const ecartC = Math.hypot(dedans[0] - dehors[0], dedans[1] - dehors[1], dedans[2] - dehors[2]);
      // Du papier à l'intérieur (une ligne de texte juste à l'intérieur n'est pas un bord de page)…
      const papierDedans =
        luma(...dedans) >= TOLERANCE_LUMINANCE * ref.lum &&
        Math.hypot(dedans[0] - ref.rvb[0], dedans[1] - ref.rvb[1], dedans[2] - ref.rvb[2]) <= TOLERANCE_COULEUR;
      // …et, juste derrière, autre chose que ce papier, même de très peu (table presque aussi claire).
      contraste = papierDedans && (ecartL >= BORD_ECART_LUMINANCE || ecartC >= BORD_ECART_COULEUR);
    }
    if (!vu) continue;
    mesures++;
    if (contraste) contrastes++;
  }
  return mesures >= ECHANTILLONS / 2 && contrastes >= BORD_PART_MIN * mesures;
}

/**
 * Premier décalage k (2 à TRAIT_MAX + 2) où la bande juste derrière la droite décalée de k a la même
 * couleur que le papier juste à l'intérieur du côté (écarts sous les seuils de `longeUnBord`, sur la
 * plupart des points), ou null. Une table presque aussi claire que le papier en diffère, elle.
 */
function papierQuiReapparait(img: ImageDataLike, a: Point, b: Point, n: Point): number | null {
  for (let k = 2; k <= TRAIT_MAX + 2; k++) {
    let mesures = 0;
    let pareils = 0;
    for (let s = 0; s < ECHANTILLONS; s++) {
      const t = DEBUT_COTE + ((FIN_COTE - DEBUT_COTE) * (s + 0.5)) / ECHANTILLONS;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const dedans = moyenneBande(img, x, y, n, 0, -1);
      const loin = moyenneBande(img, x, y, n, k, 1);
      if (!dedans || !loin) continue;
      mesures++;
      const ecartL = Math.abs(luma(...dedans) - luma(...loin));
      const ecartC = Math.hypot(dedans[0] - loin[0], dedans[1] - loin[1], dedans[2] - loin[2]);
      if (ecartL < BORD_ECART_LUMINANCE && ecartC < BORD_ECART_COULEUR) pareils++;
    }
    if (mesures >= ECHANTILLONS / 2 && pareils >= BORD_PART_MIN * mesures) return k;
  }
  return null;
}

/** Intersection des droites (p1, d1) et (p2, d2), ou null si elles sont presque parallèles. */
function intersection(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-6) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / det;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}

/**
 * Étend le cadre jusqu'au vrai bord du papier (ou au bord de la photo). Renvoie le cadre
 * d'origine, inchangé, s'il est déjà posé sur un bord ou si rien de sûr ne se dégage.
 * Coordonnées en pixels de `img`.
 */
export function etendreAuxBordsDeLaFeuille(img: ImageDataLike, quad: Quad): Quad {
  const { image, facteur } = reduirePourDetection(img, COTE_ANALYSE_PX);
  const { width: w, height: h } = image;
  const q = mettreAEchelle(quad, 1 / facteur);
  if (aireQuad(q) < AIRE_MIN * w * h) return quad;
  const ref = referencePapier(image, q);
  if (!ref) return quad;

  const centre = { x: q.reduce((s, p) => s + p.x, 0) / 4, y: q.reduce((s, p) => s + p.y, 0) / 4 };
  const maxK = Math.ceil(Math.hypot(w, h));
  const droites: { p: Point; d: Point }[] = [];
  let bouge = false;

  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const long = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d = { x: (b.x - a.x) / long, y: (b.y - a.y) / long };
    let n = { x: d.y, y: -d.x };
    if (n.x * (a.x - centre.x) + n.y * (a.y - centre.y) < 0) n = { x: -n.x, y: -n.y };

    let decalage = 0;
    let ecarts = 0;
    let surLeBordDeLaPhoto = false;
    // Un côté déjà posé sur un vrai bord ne bouge pas : derrière lui, un fond presque aussi clair
    // que le papier (blanc sur blanc, nappe claire) serait sinon pris pour la suite de la page. Sauf
    // si ce « bord » n'est qu'un trait (ligne de texte, cadre imprimé) derrière lequel le même papier
    // réapparaît : l'extension repart alors de l'autre côté du trait.
    let depart: number | null = 2;
    if (longeUnBord(image, a, b, n, 0, ref)) depart = papierQuiReapparait(image, a, b, n);
    if (depart !== null) {
      for (let k = depart; k <= maxK; k++) {
        const etat = bande(image, a, b, n, k, ref);
        if (etat === "dehors") {
          surLeBordDeLaPhoto = true;
          break;
        }
        if (etat === "papier") {
          decalage = k;
          ecarts = 0;
        } else if (++ecarts > ECARTS_TOLERES) {
          break;
        }
      }
    }
    // Le côté étendu n'est gardé que s'il s'arrête sur un vrai bord, ou sur le bord de la photo
    // quand la page continue jusque-là ; sinon le côté d'origine reste.
    const arrivee = decalage > 0 && (surLeBordDeLaPhoto || longeUnBord(image, a, b, n, decalage, ref));
    if (decalage < DEPLACEMENT_MIN || !arrivee) decalage = 0;
    else bouge = true;
    droites.push({ p: { x: a.x + n.x * decalage, y: a.y + n.y * decalage }, d });
  }
  if (!bouge) return quad;

  const coins: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const c = intersection(droites[(i + 3) % 4].p, droites[(i + 3) % 4].d, droites[i].p, droites[i].d);
    if (!c) return quad;
    coins.push({ x: Math.min(w - 1, Math.max(0, c.x)), y: Math.min(h - 1, Math.max(0, c.y)) });
  }
  const etendu = coins as Quad;
  if (!quadValide(etendu) || aireQuad(etendu) < aireQuad(q)) return quad;
  return mettreAEchelle(etendu, facteur);
}
