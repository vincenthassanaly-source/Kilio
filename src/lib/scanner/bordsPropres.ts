// Nettoyage des coins d'une page redressée : le fond noir qui reste visible dans un coin est repeint
// de la couleur du papier. Pur, sans DOM.
//
// Cas typique : la page est coupée par le bord de la photo ; une fois redressée, un triangle de
// fond noir reste dans un coin. Aucun cadre quadrilatère ne peut le supprimer, on le repeint donc.
//
// Garde-fous (une première version, plus large, a effacé une signature et du texte situés dans une
// ombre : elle prenait toute zone sombre reliée au bord pour du fond) :
// - une zone n'est repeinte que si elle touche un ou deux bords adjacents (un coin), jamais deux
//   bords opposés (bandeau) ni trois ;
// - elle doit être presque noire ET uniforme (plus encore si elle ne touche qu'un bord) : une
//   ombre contenant du texte varie beaucoup ;
// - la page doit être claire (pas une carte sombre ni une photo) et la zone ni minuscule ni énorme.

import { referencePapier } from "./extension";
import { reduirePourDetection } from "./detection";
import type { ImageDataLike } from "./geometrie";

/** Plus grand côté de l'image d'analyse (pixels). */
const COTE_ANALYSE_PX = 500;
/** Luminance minimale du papier : en dessous, la page est sombre (carte, photo) et n'est pas nettoyée. */
const LUMINANCE_PAPIER_MIN = 150;
/** Un pixel est candidat au fond s'il est sous cette part de la luminance du papier… */
const SEUIL_FOND_LUMINANCE = 0.5;
/** …et la zone doit être, en moyenne, sous cette part, avec un écart-type de luminance limité (niveaux 0-255). */
const MOYENNE_FOND_MAX = 0.4;
const ECART_TYPE_MAX = 20;
/** Une zone qui ne touche qu'un seul bord doit être plus noire et plus uniforme encore. */
const MOYENNE_FOND_UN_BORD_MAX = 0.25;
const ECART_TYPE_UN_BORD_MAX = 12;
/** Surface d'une zone de fond repeinte, en part de l'image : ni une lettre, ni la moitié de la page. */
const SURFACE_MIN = 0.0008;
const SURFACE_MAX = 0.2;

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) / 256;

/**
 * Repeint de la couleur du papier les zones de fond noir qui occupent un coin de l'image.
 * Renvoie `img` elle-même, sans copie, s'il n'y a rien à nettoyer.
 */
export function nettoyerLesBords(img: ImageDataLike): ImageDataLike {
  const { image, facteur } = reduirePourDetection(img, COTE_ANALYSE_PX);
  const { width: w, height: h, data } = image;
  const ref = referencePapier(image, [
    { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h },
  ]);
  if (!ref || ref.lum < LUMINANCE_PAPIER_MIN) return img;

  const lums = new Float32Array(w * h);
  const fond = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < fond.length; i++, p += 4) {
    lums[i] = luma(data[p], data[p + 1], data[p + 2]);
    if (lums[i] < SEUIL_FOND_LUMINANCE * ref.lum) fond[i] = 1;
  }

  // Zones de fond reliées au bord (parcours en largeur, voisinage 4), avec les bords touchés et la luminance.
  const vu = new Uint8Array(w * h);
  const aPeindre = new Uint8Array(w * h);
  const file = new Int32Array(w * h);
  const depart: number[] = [];
  for (let x = 0; x < w; x++) depart.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) depart.push(y * w, y * w + w - 1);
  for (const d of depart) {
    if (!fond[d] || vu[d]) continue;
    let tete = 0, queue = 0;
    file[queue++] = d;
    vu[d] = 1;
    let haut = false, bas = false, gauche = false, droite = false;
    let somme = 0, sommeCarres = 0;
    while (tete < queue) {
      const i = file[tete++];
      const x = i % w;
      const y = (i - x) / w;
      if (y === 0) haut = true;
      if (y === h - 1) bas = true;
      if (x === 0) gauche = true;
      if (x === w - 1) droite = true;
      somme += lums[i];
      sommeCarres += lums[i] * lums[i];
      if (x > 0 && fond[i - 1] && !vu[i - 1]) { vu[i - 1] = 1; file[queue++] = i - 1; }
      if (x < w - 1 && fond[i + 1] && !vu[i + 1]) { vu[i + 1] = 1; file[queue++] = i + 1; }
      if (y > 0 && fond[i - w] && !vu[i - w]) { vu[i - w] = 1; file[queue++] = i - w; }
      if (y < h - 1 && fond[i + w] && !vu[i + w]) { vu[i + w] = 1; file[queue++] = i + w; }
    }
    const surface = queue / (w * h);
    if (surface < SURFACE_MIN || surface > SURFACE_MAX) continue;
    // Jamais deux bords opposés (bandeau sur toute la largeur) ni trois. Un coin (un bord vertical et
    // un bord horizontal) ou un seul bord est possible, ce dernier à condition d'être très noir.
    const bords = [haut, bas, gauche, droite].filter(Boolean).length;
    if (haut === bas && haut) continue;
    if (gauche === droite && gauche) continue;
    if (bords === 0 || bords > 2) continue;
    const moyenne = somme / queue;
    const ecartType = Math.sqrt(Math.max(0, sommeCarres / queue - moyenne * moyenne));
    const noirMax = bords === 2 ? MOYENNE_FOND_MAX : MOYENNE_FOND_UN_BORD_MAX;
    const ecartMax = bords === 2 ? ECART_TYPE_MAX : ECART_TYPE_UN_BORD_MAX;
    if (moyenne > noirMax * ref.lum || ecartType > ecartMax) continue;
    for (let k = 0; k < queue; k++) aPeindre[file[k]] = 1;
  }
  if (!aPeindre.some((v) => v === 1)) return img;

  // Repeint en pleine résolution ; on élargit d'un pixel d'analyse pour couvrir le liseré anti-crénelé.
  const { data: source, width: W, height: H } = img;
  const sortie = new Uint8ClampedArray(source);
  const [pr, pg, pb] = ref.rvb;
  for (let y = 0; y < H; y++) {
    const ry = Math.min(h - 1, Math.floor(y / facteur));
    for (let x = 0; x < W; x++) {
      const rx = Math.min(w - 1, Math.floor(x / facteur));
      let peindre = false;
      for (let dy = -1; dy <= 1 && !peindre; dy++) {
        const yy = ry + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = rx + dx;
          if (xx >= 0 && xx < w && aPeindre[yy * w + xx]) {
            peindre = true;
            break;
          }
        }
      }
      if (!peindre) continue;
      const o = (y * W + x) * 4;
      sortie[o] = pr; sortie[o + 1] = pg; sortie[o + 2] = pb; sortie[o + 3] = 255;
    }
  }
  return { data: sortie, width: W, height: H };
}
