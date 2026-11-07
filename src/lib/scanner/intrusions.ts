// Effacement des intrusions au bord d'une page redressée : bande de fond sombre le long d'un côté, doigt
// ou main qui tient la feuille, fins traits sombres tout en haut. Ces zones sont repeintes de la
// couleur du papier. Pur, sans DOM.
//
// Complète `bordsPropres.ts`, qui ne traite que les coins et refuse tout ce qui touche deux bords
// opposés (une bande le long d'un côté touche le haut et le bas).
//
// Garde-fous (l'écriture, le code QR et les tampons ne doivent jamais être touchés) :
// - la zone doit être sombre et ÉPAISSE : une ouverture morphologique supprime tout trait plus fin
//   que quelques pour cent de la page (lettres, signature, modules d'un code QR) ;
// - elle doit toucher un bord sur une longueur notable, couvrir une surface notable et ne pas
//   s'avancer de plus de 30 % dans la page ;
// - la page doit être claire (pas une carte sombre ni une photo) ;
// - en haut, seuls de fins traits plats, entièrement dans la toute première bande, sont repeints.

import { reduirePourDetection } from "./detection";
import { referencePapier } from "./extension";
import type { ImageDataLike } from "./geometrie";

/** Plus grand côté de l'image d'analyse (pixels). */
const COTE_ANALYSE_PX = 500;
/** Luminance minimale du papier : en dessous, la page est sombre (carte, photo) et n'est pas nettoyée. */
const LUMINANCE_PAPIER_MIN = 150;
/**
 * Deux niveaux de « non papier » (part de la luminance du papier, étendue maximale vers l'intérieur) :
 * - très sombre (bande de fond, ombre de la main) : jusqu'à 30 % dans la page ;
 * - moyennement sombre (peau, doigt) : seulement si la zone reste collée au bord (12 % au plus), ce
 *   qui exclut l'ombre du papier lui-même, qui s'étend loin dans la page.
 */
const NIVEAUX = [
  { seuil: 0.55, etendue: 0.3 },
  { seuil: 0.75, etendue: 0.12 },
];
/** Rayon de l'ouverture morphologique, en part du plus grand côté : plus épais = zone d'intrusion. */
const RAYON_OUVERTURE = 0.008;
/** Surface minimale d'une intrusion (part de l'image) et contact minimal avec un bord (part de ce côté). */
const SURFACE_MIN = 0.01;
const CONTACT_MIN = 0.04;
/** Marge repeinte autour d'une intrusion (part du plus grand côté) : couvre le liseré et l'ongle clair. */
const MARGE_PEINTURE = 0.008;
/** Traits sombres du haut : entièrement dans cette part de la hauteur, assez larges, assez fins. */
const BANDE_HAUT = 0.025;
const LARGEUR_TRAIT_MIN = 0.03;
const EPAISSEUR_TRAIT_MAX = 0.012;

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) / 256;

/** Érosion (min) puis dilatation (max) binaires, carrées de rayon r, bords exclus de la fenêtre. */
function ouverture(masque: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const passe = (src: Uint8Array, max: boolean): Uint8Array => {
    const tmp = new Uint8Array(src.length);
    const out = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = max ? 0 : 1;
        for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
          const s = src[y * w + k];
          if (max ? s : !s) { v = max ? 1 : 0; break; }
        }
        tmp[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = max ? 0 : 1;
        for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
          const s = tmp[k * w + x];
          if (max ? s : !s) { v = max ? 1 : 0; break; }
        }
        out[y * w + x] = v;
      }
    }
    return out;
  };
  return passe(passe(masque, false), true);
}

/** Composantes connexes d'un masque : indices des pixels de chacune (voisinage 4 ou 8). */
function composantes(masque: Uint8Array, w: number, h: number, huit: boolean): Int32Array[] {
  const vu = new Uint8Array(masque.length);
  const file = new Int32Array(masque.length);
  const resultat: Int32Array[] = [];
  for (let depart = 0; depart < masque.length; depart++) {
    if (!masque[depart] || vu[depart]) continue;
    let tete = 0, queue = 0;
    file[queue++] = depart;
    vu[depart] = 1;
    while (tete < queue) {
      const i = file[tete++];
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!huit && dx !== 0 && dy !== 0)) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (masque[j] && !vu[j]) { vu[j] = 1; file[queue++] = j; }
        }
      }
    }
    resultat.push(file.slice(0, queue));
  }
  return resultat;
}

/**
 * Repeint de la couleur du papier les zones sombres épaisses qui touchent un bord (bande, doigt) et les
 * fins traits sombres du haut. Renvoie `img` elle-même, sans copie, s'il n'y a rien à nettoyer.
 */
export function effacerLesIntrusions(img: ImageDataLike): ImageDataLike {
  const { image, facteur } = reduirePourDetection(img, COTE_ANALYSE_PX);
  const { width: w, height: h, data } = image;
  const ref = referencePapier(image, [
    { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h },
  ]);
  if (!ref || ref.lum < LUMINANCE_PAPIER_MIN) return img;

  const lums = new Float32Array(w * h);
  for (let i = 0, p = 0; i < lums.length; i++, p += 4) lums[i] = luma(data[p], data[p + 1], data[p + 2]);
  const masqueSous = (part: number) => {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) if (lums[i] < part * ref.lum) m[i] = 1;
    return m;
  };

  const aPeindre = new Uint8Array(w * h);
  let rien = true;

  // 1. Intrusions épaisses reliées à un bord (bande, doigt), à chaque niveau de noirceur.
  const rayon = Math.max(2, Math.round(RAYON_OUVERTURE * Math.max(w, h)));
  for (const { seuil, etendue } of NIVEAUX) {
    const epais = ouverture(masqueSous(seuil), w, h, rayon);
    for (const zone of composantes(epais, w, h, false)) {
      if (zone.length < SURFACE_MIN * w * h) continue;
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let haut = 0, bas = 0, gauche = 0, droite = 0;
      for (let k = 0; k < zone.length; k++) {
        const i = zone[k];
        const x = i % w;
        const y = (i - x) / w;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (y === 0) haut++;
        if (y === h - 1) bas++;
        if (x === 0) gauche++;
        if (x === w - 1) droite++;
      }
      // Contact avec un bord sur une longueur notable, et étendue limitée vers l'intérieur de la page.
      const aGauche = gauche >= CONTACT_MIN * h && maxX - minX + 1 <= etendue * w;
      const aDroite = droite >= CONTACT_MIN * h && maxX - minX + 1 <= etendue * w;
      const enHaut = haut >= CONTACT_MIN * w && maxY - minY + 1 <= etendue * h;
      const enBas = bas >= CONTACT_MIN * w && maxY - minY + 1 <= etendue * h;
      if (!(aGauche || aDroite || enHaut || enBas)) continue;
      for (let k = 0; k < zone.length; k++) aPeindre[zone[k]] = 1;
      rien = false;
    }
  }

  // 2. Fins traits sombres plats, entièrement dans la toute première bande de la page.
  for (const trait of composantes(masqueSous(NIVEAUX[0].seuil), w, h, true)) {
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let k = 0; k < trait.length; k++) {
      const i = trait[k];
      const x = i % w;
      const y = (i - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxY >= BANDE_HAUT * h) continue;
    if (maxX - minX + 1 < LARGEUR_TRAIT_MIN * w || maxY - minY + 1 > EPAISSEUR_TRAIT_MAX * h) continue;
    for (let k = 0; k < trait.length; k++) aPeindre[trait[k]] = 1;
    rien = false;
  }
  if (rien) return img;

  // Marge autour des zones repeintes (dilatation carrée), puis repeinture en pleine résolution.
  const marge = Math.max(1, Math.round(MARGE_PEINTURE * Math.max(w, h)));
  const large = new Uint8Array(w * h);
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let k = Math.max(0, x - marge); k <= Math.min(w - 1, x + marge); k++) {
        if (aPeindre[y * w + k]) { tmp[y * w + x] = 1; break; }
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let k = Math.max(0, y - marge); k <= Math.min(h - 1, y + marge); k++) {
        if (tmp[k * w + x]) { large[y * w + x] = 1; break; }
      }
    }
  }
  const { data: source, width: W, height: H } = img;
  const sortie = new Uint8ClampedArray(source);
  const [pr, pg, pb] = ref.rvb;
  for (let y = 0; y < H; y++) {
    const ry = Math.min(h - 1, Math.floor(y / facteur));
    for (let x = 0; x < W; x++) {
      if (!large[ry * w + Math.min(w - 1, Math.floor(x / facteur))]) continue;
      const o = (y * W + x) * 4;
      sortie[o] = pr; sortie[o + 1] = pg; sortie[o + 2] = pb; sortie[o + 3] = 255;
    }
  }
  return { data: sortie, width: W, height: H };
}
