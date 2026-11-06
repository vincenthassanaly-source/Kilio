// Recalage des côtés du cadre sur le vrai bord de la page. Pur, sans DOM.
//
// Problème : l'extension du cadre (extension.ts) repousse chaque côté vers l'extérieur mais
// garde l'inclinaison du côté d'origine. Si ce côté venait d'un pli ou d'un bloc de texte, il
// n'est pas parallèle au vrai bord : après redressement, les bords ne sont pas droits et un
// coin de fond reste visible.
//
// Remède : pour chaque côté, on cherche en plusieurs points où le fond laisse la place au
// papier (balayage de l'extérieur vers l'intérieur, le texte intérieur ne gêne donc pas), puis
// on ajuste une droite sur ces points en écartant les aberrants. Un côté sans bord net
// (page qui déborde de la photo, ou fond de la couleur du papier) garde sa droite d'origine.

import { referencePapier, type Rvb } from "./extension";
import { reduirePourDetection } from "./detection";
import { aireQuad, mettreAEchelle, quadValide, type ImageDataLike, type Point, type Quad } from "./geometrie";

/** Plus grand côté de l'image d'analyse (pixels). */
const COTE_ANALYSE_PX = 600;
/** Part minimale de l'image que le cadre doit couvrir : on n'affine pas une petite carte. */
const AIRE_MIN = 0.25;
/** Points de mesure le long d'un côté (on ignore les 6 % de chaque extrémité). */
const POINTS_PAR_COTE = 48;
const DEBUT_COTE = 0.06;
const FIN_COTE = 0.94;
/** Portée du balayage de part et d'autre du côté, en part du plus petit côté de l'image d'analyse. */
const PORTEE = 0.09;
/** Pixels consécutifs requis pour valider « fond » puis « papier ». */
const PAS_CONFIRMATION = 3;
/** Une mesure de bord n'est gardée que s'il y en a au moins ce nombre, dont la moitié proches de la droite ajustée. */
const POINTS_MIN = 10;
/** Écart (pixels d'analyse) au-delà duquel une mesure est jugée aberrante. */
const TOLERANCE_ABERRANT = 1.8;
/** Un coin ne bouge jamais de plus de cette part de la diagonale : au-delà, on garde le cadre d'origine. */
const DEPLACEMENT_MAX = 0.08;
/** Écart angulaire maximal entre la droite ajustée et le côté d'origine (degrés). */
const ANGLE_MAX_DEG = 8;
/** Mêmes seuils que extension.ts pour reconnaître le papier. */
const TOLERANCE_LUMINANCE = 0.9;
const TOLERANCE_COULEUR = 32;

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) / 256;

type Ref = { rvb: Rvb; lum: number };

/** Vrai si le pixel (x, y) a la couleur du papier ; moyenne de 3 pixels le long du côté (d) pour le grain. */
function estPapier(img: ImageDataLike, x: number, y: number, d: Point, ref: Ref): boolean | null {
  let r = 0, g = 0, b = 0, n = 0;
  for (const k of [-1, 0, 1]) {
    const px = Math.round(x + d.x * k);
    const py = Math.round(y + d.y * k);
    if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
    const i = (py * img.width + px) * 4;
    r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
  }
  if (n === 0) return null; // hors de l'image
  r /= n; g /= n; b /= n;
  const dist = Math.hypot(r - ref.rvb[0], g - ref.rvb[1], b - ref.rvb[2]);
  return luma(r, g, b) >= TOLERANCE_LUMINANCE * ref.lum && dist <= TOLERANCE_COULEUR;
}

/**
 * Point du vrai bord le long de la normale n passant par p : balayage de l'extérieur (+portée)
 * vers l'intérieur (−portée). Renvoie le premier point « papier » précédé de fond, ou null.
 */
function pointDeBord(img: ImageDataLike, p: Point, n: Point, d: Point, portee: number, ref: Ref): Point | null {
  const etats: (boolean | null)[] = [];
  for (let k = portee; k >= -portee; k--) {
    etats.push(estPapier(img, p.x + n.x * k, p.y + n.y * k, d, ref));
  }
  // Départ : il faut commencer par du fond (ou par le dehors de l'image), pas par du papier.
  let debut = 0;
  while (debut < etats.length && etats[debut] === null) debut++;
  if (debut >= etats.length || etats[debut] !== false) return null;
  let fond = 0;
  for (let i = debut; i < etats.length; i++) {
    if (etats[i] === false) {
      fond++;
      continue;
    }
    if (etats[i] !== true || fond < PAS_CONFIRMATION) return null;
    let papier = 0;
    for (let j = i; j < Math.min(etats.length, i + PAS_CONFIRMATION); j++) if (etats[j] === true) papier++;
    if (papier < PAS_CONFIRMATION) {
      fond = 0; // simple tache : on continue à chercher
      continue;
    }
    const k = portee - i;
    return { x: p.x + n.x * k, y: p.y + n.y * k };
  }
  return null;
}

/** Droite (point, direction unitaire) ajustée par moindres carrés orthogonaux, en écartant les aberrants. */
function ajusterDroite(points: Point[]): { p: Point; d: Point; inliers: number } | null {
  let retenus = points;
  let droite: { p: Point; d: Point } | null = null;
  for (let tour = 0; tour < 4; tour++) {
    if (retenus.length < 2) return null;
    const cx = retenus.reduce((s, q) => s + q.x, 0) / retenus.length;
    const cy = retenus.reduce((s, q) => s + q.y, 0) / retenus.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const q of retenus) {
      sxx += (q.x - cx) ** 2;
      syy += (q.y - cy) ** 2;
      sxy += (q.x - cx) * (q.y - cy);
    }
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const courante = { p: { x: cx, y: cy }, d: { x: Math.cos(theta), y: Math.sin(theta) } };
    droite = courante;
    const ecart = (q: Point) => Math.abs((q.x - cx) * -courante.d.y + (q.y - cy) * courante.d.x);
    const suivants = points.filter((q) => ecart(q) <= TOLERANCE_ABERRANT);
    if (suivants.length === retenus.length) break;
    retenus = suivants;
  }
  return droite ? { ...droite, inliers: retenus.length } : null;
}

function intersection(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-6) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / det;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}

/**
 * Recale les quatre côtés du cadre sur le vrai bord de la page. Renvoie le cadre d'origine,
 * inchangé, s'il est déjà juste ou si aucun bord net n'est mesurable. Coordonnées en pixels de `img`.
 */
export function affinerLesCotes(img: ImageDataLike, quad: Quad): Quad {
  const { image, facteur } = reduirePourDetection(img, COTE_ANALYSE_PX);
  const { width: w, height: h } = image;
  const q = mettreAEchelle(quad, 1 / facteur);
  if (aireQuad(q) < AIRE_MIN * w * h) return quad;
  const ref = referencePapier(image, q);
  if (!ref) return quad;

  const centre = { x: q.reduce((s, p) => s + p.x, 0) / 4, y: q.reduce((s, p) => s + p.y, 0) / 4 };
  const portee = Math.max(4, Math.round(PORTEE * Math.min(w, h)));
  const droites: { p: Point; d: Point }[] = [];
  let aAffine = false;

  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const long = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d = { x: (b.x - a.x) / long, y: (b.y - a.y) / long };
    let n = { x: d.y, y: -d.x };
    if (n.x * (a.x - centre.x) + n.y * (a.y - centre.y) < 0) n = { x: -n.x, y: -n.y };

    const mesures: Point[] = [];
    for (let s = 0; s < POINTS_PAR_COTE; s++) {
      const t = DEBUT_COTE + ((FIN_COTE - DEBUT_COTE) * (s + 0.5)) / POINTS_PAR_COTE;
      const bord = pointDeBord(image, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, n, d, portee, ref);
      if (bord) mesures.push(bord);
    }

    let retenue = { p: a, d };
    if (mesures.length >= POINTS_MIN) {
      const ajustee = ajusterDroite(mesures);
      if (ajustee && ajustee.inliers >= Math.max(POINTS_MIN, mesures.length / 2)) {
        const cos = Math.abs(ajustee.d.x * d.x + ajustee.d.y * d.y);
        if (Math.acos(Math.min(1, cos)) * (180 / Math.PI) <= ANGLE_MAX_DEG) {
          // Même sens que le côté d'origine, pour des intersections cohérentes.
          const sens = ajustee.d.x * d.x + ajustee.d.y * d.y < 0 ? -1 : 1;
          retenue = { p: ajustee.p, d: { x: ajustee.d.x * sens, y: ajustee.d.y * sens } };
          aAffine = true;
        }
      }
    }
    droites.push(retenue);
  }
  if (!aAffine) return quad;

  const coins: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const c = intersection(droites[(i + 3) % 4].p, droites[(i + 3) % 4].d, droites[i].p, droites[i].d);
    if (!c) return quad;
    coins.push({ x: Math.min(w - 1, Math.max(0, c.x)), y: Math.min(h - 1, Math.max(0, c.y)) });
  }
  const diagonale = Math.hypot(w, h);
  if (coins.some((c, i) => Math.hypot(c.x - q[i].x, c.y - q[i].y) > DEPLACEMENT_MAX * diagonale)) return quad;
  const affine = coins as Quad;
  if (!quadValide(affine)) return quad;
  return mettreAEchelle(affine, facteur);
}
