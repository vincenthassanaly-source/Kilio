// Filtre « Magic color » : supprime les ombres et uniformise l'éclairage tout
// en gardant les couleurs, comme le filtre phare de CamScanner.
//
// Principe : on estime le fond (la couleur du papier éclairé) par bloc, en
// prenant un percentile élevé de chaque canal ; on divise l'image par ce fond
// (le papier devient blanc, l'ombre disparaît) puis on étire les niveaux pour
// foncer l'encre. Pur et sans DOM.

import type { ImageDataLike } from "./geometrie";

export type Filtre = "original" | "magic";

/** Nombre de blocs visés sur le plus grand côté pour estimer le fond. */
const BLOCS_SUR_GRAND_COTE = 40;
/** Percentile du fond dans un bloc : 0,9 ignore l'encre mais pas le papier. */
const PERCENTILE_FOND = 0.9;
/** Sous ce rapport pixel/fond, le pixel est noir ; au-dessus du haut, blanc. */
const BAS = 0.5;
const HAUT = 0.93;

function percentile(valeurs: number[], p: number): number {
  valeurs.sort((a, b) => a - b);
  return valeurs[Math.min(valeurs.length - 1, Math.floor(valeurs.length * p))];
}

/** Flou de boîte 3×3 sur une grille de blocs (3 canaux entrelacés). */
function flouterGrille(g: Float32Array, gw: number, gh: number): Float32Array {
  // Typé explicitement : évite l'inférence `Float32Array<ArrayBuffer>` (TS 5.7+).
  const sortie = new Float32Array(g.length);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      for (let c = 0; c < 3; c++) {
        let somme = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
            somme += g[(yy * gw + xx) * 3 + c];
            n++;
          }
        }
        sortie[(y * gw + x) * 3 + c] = somme / n;
      }
    }
  }
  return sortie;
}

/** Applique « Magic color » et renvoie une nouvelle image (l'entrée n'est pas modifiée). */
export function magicColor(img: ImageDataLike): ImageDataLike {
  const { data, width: w, height: h } = img;
  const taille = Math.max(4, Math.round(Math.max(w, h) / BLOCS_SUR_GRAND_COTE));
  const gw = Math.max(1, Math.ceil(w / taille));
  const gh = Math.max(1, Math.ceil(h / taille));

  // Fond estimé par bloc et par canal.
  let fond: Float32Array = new Float32Array(gw * gh * 3);
  for (let by = 0; by < gh; by++) {
    for (let bx = 0; bx < gw; bx++) {
      const x0 = bx * taille;
      const y0 = by * taille;
      const x1 = Math.min(w, x0 + taille);
      const y1 = Math.min(h, y0 + taille);
      const canaux: number[][] = [[], [], []];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          canaux[0].push(data[i]);
          canaux[1].push(data[i + 1]);
          canaux[2].push(data[i + 2]);
        }
      }
      for (let c = 0; c < 3; c++) fond[(by * gw + bx) * 3 + c] = percentile(canaux[c], PERCENTILE_FOND);
    }
  }
  // Lisse le fond : une tache d'encre épaisse ne doit pas creuser un trou clair.
  fond = flouterGrille(flouterGrille(fond, gw, gh), gw, gh);

  const sortie = new Uint8ClampedArray(data.length);
  const echelle = 255 / (HAUT - BAS);
  for (let y = 0; y < h; y++) {
    // Interpolation bilinéaire du fond entre les centres de blocs.
    const gy = Math.min(gh - 1, Math.max(0, (y + 0.5) / taille - 0.5));
    const gy0 = Math.floor(gy);
    const gy1 = Math.min(gh - 1, gy0 + 1);
    const fy = gy - gy0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(gw - 1, Math.max(0, (x + 0.5) / taille - 0.5));
      const gx0 = Math.floor(gx);
      const gx1 = Math.min(gw - 1, gx0 + 1);
      const fx = gx - gx0;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const f00 = fond[(gy0 * gw + gx0) * 3 + c];
        const f10 = fond[(gy0 * gw + gx1) * 3 + c];
        const f01 = fond[(gy1 * gw + gx0) * 3 + c];
        const f11 = fond[(gy1 * gw + gx1) * 3 + c];
        const f = (f00 * (1 - fx) + f10 * fx) * (1 - fy) + (f01 * (1 - fx) + f11 * fx) * fy;
        const rapport = f > 1 ? data[i + c] / f : 1;
        sortie[i + c] = (rapport - BAS) * echelle;
      }
      sortie[i + 3] = 255;
    }
  }
  return { data: sortie, width: w, height: h };
}

/** Applique le filtre choisi ; « original » renvoie l'image telle quelle. */
export function appliquerFiltre(img: ImageDataLike, filtre: Filtre): ImageDataLike {
  return filtre === "magic" ? magicColor(img) : img;
}
