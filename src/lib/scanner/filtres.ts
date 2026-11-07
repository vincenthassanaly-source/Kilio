// Filtre d'image du scanner. Pur, sans DOM.
//
// Un seul filtre, « Magique », qui reproduit « Magique Pro » de CamScanner : papier blanc pur,
// texte noir et épais, tampons et signatures qui gardent leurs demi-tons, couleurs conservées.
//   Une balance des blancs *globale* (mêmes gains partout, donc les rapports de
//   couleur sont conservés), puis un gain calculé sur la LUMINANCE seule et
//   appliqué de la même façon aux trois canaux. Diviser chaque canal par son
//   propre fond (ancienne version) décalait les teintes dès que le fond
//   changeait de couleur : c'est ce qui donnait des couleurs fausses. Le fond
//   d'éclairage (fermeture morphologique) efface ombres et plis ; la netteté du texte
//   est renforcée ; l'encre neutre reçoit une courbe tranchée, les pixels franchement
//   colorés (logo, photo) une courbe douce pour ne pas être écrasés en noir.

import type { ImageDataLike } from "./geometrie";

/**
 * Filtre enregistré avec une page. Le scanner n'applique plus que « magic » ; les autres
 * valeurs restent pour relire sans erreur les pages du brouillon créées avec les anciens filtres.
 */
export type Filtre = "original" | "noirblanc" | "couleurs" | "magic";

/** Plus grand côté (en pixels) de la grille grossière servant à estimer l'éclairage. */
const COTE_GRILLE = 420;

/* ---------- Outils : grilles grossières ---------- */

type Grille = { p: Float32Array; w: number; h: number };

/** Réduit un plan par moyenne de blocs de `s`×`s` pixels. */
function reduireMoyenne(plan: Float32Array, w: number, h: number, s: number): Grille {
  const gw = Math.ceil(w / s);
  const gh = Math.ceil(h / s);
  const p = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y1 = Math.min(h, (gy + 1) * s);
    for (let gx = 0; gx < gw; gx++) {
      const x1 = Math.min(w, (gx + 1) * s);
      let somme = 0;
      let n = 0;
      for (let y = gy * s; y < y1; y++) {
        for (let x = gx * s; x < x1; x++) {
          somme += plan[y * w + x];
          n++;
        }
      }
      p[gy * gw + gx] = somme / n;
    }
  }
  return { p, w: gw, h: gh };
}

/** Maximum (dilatation) ou minimum (érosion) glissant, séparable, rayon `r`. */
function extremum(g: Grille, r: number, max: boolean): Grille {
  const { w, h } = g;
  const tmp = new Float32Array(g.p.length);
  const out = new Float32Array(g.p.length);
  const meilleur = (a: number, b: number) => (max ? (a > b ? a : b) : a < b ? a : b);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = g.p[y * w + x];
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = meilleur(m, g.p[y * w + k]);
      tmp[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = tmp[y * w + x];
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = meilleur(m, tmp[k * w + x]);
      out[y * w + x] = m;
    }
  }
  return { p: out, w, h };
}

/** Flou de boîte séparable de rayon `r` (bords : moyenne sur la partie valide). */
function flouBoite(g: Grille, r: number): Grille {
  const { w, h } = g;
  const tmp = new Float32Array(g.p.length);
  const out = new Float32Array(g.p.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) { s += g.p[y * w + k]; n++; }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) { s += tmp[k * w + x]; n++; }
      out[y * w + x] = s / n;
    }
  }
  return { p: out, w, h };
}

/** Lecture bilinéaire de la grille au pixel plein format (x, y). */
function lire(g: Grille, s: number, x: number, y: number): number {
  const fx = Math.min(g.w - 1, Math.max(0, (x + 0.5) / s - 0.5));
  const fy = Math.min(g.h - 1, Math.max(0, (y + 0.5) / s - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(g.w - 1, x0 + 1);
  const y1 = Math.min(g.h - 1, y0 + 1);
  const ax = fx - x0;
  const ay = fy - y0;
  return (g.p[y0 * g.w + x0] * (1 - ax) + g.p[y0 * g.w + x1] * ax) * (1 - ay) + (g.p[y1 * g.w + x0] * (1 - ax) + g.p[y1 * g.w + x1] * ax) * ay;
}

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) / 256;

/** Plans R, V, B (flottants 0-255). */
function plansRVB(img: ImageDataLike) {
  const { data, width: w, height: h } = img;
  const n = w * h;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    r[i] = data[p];
    g[i] = data[p + 1];
    b[i] = data[p + 2];
  }
  return { r, g, b };
}

function percentile(valeurs: Float32Array, p: number): number {
  const copie = Float32Array.from(valeurs).sort();
  return copie[Math.min(copie.length - 1, Math.floor(copie.length * p))];
}

/* ---------- Magic color ---------- */

/**
 * Courbe tonale de l'encre neutre (texte noir ou gris, tampon) : rapport pixel/fond en dessous
 * duquel le pixel est noir, au-dessus duquel il est blanc, et part de la courbe linéaire (le
 * reste est une courbe en S). Tranchée, comme « Magique Pro » de CamScanner : texte noir et
 * épais, papier blanc pur, demi-tons du tampon conservés.
 */
const NOIR = 0.42;
const BLANC = 0.8;
const PART_LINEAIRE = 0.1;
/**
 * Courbe douce des pixels franchement colorés (logo, photo, tampon rouge) : ils gardent leur
 * teinte et leur valeur au lieu d'être écrasés en noir par la courbe tranchée.
 */
const NOIR_COULEUR = 0.1;
const BLANC_COULEUR = 0.94;
const PART_LINEAIRE_COULEUR = 0.65;
/** Écart max-min (niveaux 0-255) sous lequel un pixel est de l'encre neutre, au-dessus duquel c'est de la couleur. */
const COULEUR_MIN = 30;
const COULEUR_MAX = 70;
/** Netteté (masque flou) sur le rapport au fond : rayon du flou (pixels pour 1000 px de côté) et gain. */
const RAYON_NETTETE = 1.2;
const GAIN_NETTETE = 1.1;
/** Rayon de la fermeture morphologique, en fraction du plus grand côté de la grille. */
const RAYON_FOND = 0.05;
/** Gain de saturation (légèrement > 1 : compense l'éclaircissement du fond). */
const SATURATION_MAGIC = 1.06;
/** Saturation relative (écart max-min / luminance) au-delà de laquelle une zone sombre est protégée. */
const SATURATION_PROTEGEE = 0.2;
/** Et écart absolu minimal (niveaux 0-255) : sous ce seuil c'est du gris, pas de la couleur. */
const SATURATION_MIN_ABS = 22;
/** Bornes des gains de balance des blancs : on ne « corrige » pas un vrai papier coloré à outrance. */
const WB_MIN = 0.75;
const WB_MAX = 1.33;

/** Rapport pixel/fond à partir duquel un pixel peut être du papier (neutralisé progressivement). */
const PAPIER_DEBUT = 0.8;
const PAPIER_FIN = 0.95;
/** Écart max-min (niveaux 0-255) sous lequel un pixel clair est du papier teinté, au-dessus duquel c'est de la couleur. */
const PAPIER_CHROMA_MIN = 28;
const PAPIER_CHROMA_MAX = 70;

/** Marche douce de 0 (en dessous de `a`) à 1 (au-dessus de `b`). */
function lisser(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Courbe en S entre deux seuils, avec une part linéaire qui garde les demi-tons lisibles. */
function courbeEnS(rapport: number, noir: number, blanc: number, partLineaire: number): number {
  const t = Math.min(1, Math.max(0, (rapport - noir) / (blanc - noir)));
  return partLineaire * t + (1 - partLineaire) * t * t * (3 - 2 * t);
}

/** Courbe tonale d'un pixel : tranchée pour l'encre neutre, douce pour la couleur (`couleur` de 0 à 1). */
function courbeMagic(rapport: number, couleur: number): number {
  const neutre = courbeEnS(rapport, NOIR, BLANC, PART_LINEAIRE);
  const colore = courbeEnS(rapport, NOIR_COULEUR, BLANC_COULEUR, PART_LINEAIRE_COULEUR);
  return neutre + (colore - neutre) * couleur;
}

/** Applique « Magic color » et renvoie une nouvelle image (l'entrée n'est pas modifiée). */
export function magicColor(img: ImageDataLike): ImageDataLike {
  const { width: w, height: h } = img;
  const { r, g, b } = plansRVB(img);
  const s = Math.max(1, Math.round(Math.max(w, h) / COTE_GRILLE));

  // 1. Balance des blancs globale : le papier (les 15 % de zones les plus claires) devient neutre.
  const gr = reduireMoyenne(r, w, h, s);
  const gg = reduireMoyenne(g, w, h, s);
  const gb = reduireMoyenne(b, w, h, s);
  const gl = new Float32Array(gr.p.length);
  for (let i = 0; i < gl.length; i++) gl[i] = luma(gr.p[i], gg.p[i], gb.p[i]);
  const seuilPapier = percentile(gl, 0.85);
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < gl.length; i++) {
    if (gl[i] < seuilPapier) continue;
    sr += gr.p[i]; sg += gg.p[i]; sb += gb.p[i]; n++;
  }
  const mr = n ? sr / n : 255, mg = n ? sg / n : 255, mb = n ? sb / n : 255;
  const cible = luma(mr, mg, mb);
  const borne = (v: number) => Math.min(WB_MAX, Math.max(WB_MIN, v));
  const wbR = borne(cible / Math.max(mr, 1));
  const wbG = borne(cible / Math.max(mg, 1));
  const wbB = borne(cible / Math.max(mb, 1));

  // 2. Fond d'éclairage : fermeture morphologique de la luminance équilibrée (efface l'encre
  //    et les détails sombres plus fins que le noyau, garde ombres et dégradés), lissée.
  const grille: Grille = { p: new Float32Array(gr.p.length), w: gr.w, h: gr.h };
  for (let i = 0; i < grille.p.length; i++) grille.p[i] = luma(gr.p[i] * wbR, gg.p[i] * wbG, gb.p[i] * wbB);
  // Protection du contenu coloré : une grande zone sombre ET saturée (photo, tampon, logo
  // épais) n'est pas une ombre. On la fait compter comme « papier » dans l'estimation du fond,
  // sans quoi elle serait éclaircie et ses couleurs faussées (un brun deviendrait pêche).
  const niveauPapier = percentile(grille.p, 0.85);
  for (let i = 0; i < grille.p.length; i++) {
    const rr = gr.p[i] * wbR, gg2 = gg.p[i] * wbG, bb = gb.p[i] * wbB;
    const saturation = Math.max(rr, gg2, bb) - Math.min(rr, gg2, bb);
    // Minimum absolu : l'encre noire, souvent légèrement bleutée, n'est pas « colorée ».
    if (grille.p[i] < 0.8 * niveauPapier && saturation > SATURATION_MIN_ABS && saturation > SATURATION_PROTEGEE * Math.max(grille.p[i], 1)) grille.p[i] = 255;
  }
  const rayon = Math.max(2, Math.round(RAYON_FOND * Math.max(grille.w, grille.h)));
  const fond = flouBoite(extremum(extremum(grille, rayon, true), rayon, false), Math.max(1, Math.round(rayon / 2)));

  // 3. Rapport au fond de chaque pixel (≈ 1 sur le papier, bien plus bas sur l'encre), puis
  //    netteté par masque flou : les bords des lettres se creusent avant la courbe tonale.
  const rapports: Grille = { p: new Float32Array(w * h), w, h };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      const yy = luma(r[i] * wbR, g[i] * wbG, b[i] * wbB);
      rapports.p[i] = Math.min(1.3, yy / Math.max(24, lire(fond, s, px, py)));
    }
  }
  const rayonNetteteSource = Math.max(1, Math.round((RAYON_NETTETE * Math.max(w, h)) / 1000));
  const flou = flouBoite(flouBoite(rapports, rayonNetteteSource), rayonNetteteSource);

  // 4. Par pixel : rapport net → courbe → même facteur sur les trois canaux.
  const sortie = new Uint8ClampedArray(img.data.length);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      const o = i * 4;
      const rr = r[i] * wbR, gg2 = g[i] * wbG, bb = b[i] * wbB;
      const yy = luma(rr, gg2, bb);
      const rapportBrut = rapports.p[i];
      const rapport = rapportBrut + GAIN_NETTETE * (rapportBrut - flou.p[i]);
      const couleur = lisser(COULEUR_MIN, COULEUR_MAX, Math.max(rr, gg2, bb) - Math.min(rr, gg2, bb));
      const cibleY = courbeMagic(rapport, couleur) * 255;
      let nr = cibleY, ng = cibleY, nb = cibleY;
      if (yy > 1) {
        let k = cibleY / yy;
        const max = Math.max(rr, gg2, bb);
        if (max * k > 255) k = 255 / max; // pas d'écrêtage d'un seul canal : on garde la teinte
        nr = rr * k; ng = gg2 * k; nb = bb * k;
      }
      // Papier : un pixel clair et peu coloré redevient neutre. La balance des blancs globale ne
      // suffit pas quand l'éclairage change d'une zone à l'autre (reflet bleuté, lampe chaude) ;
      // l'encre, les tampons et les logos (saturés ou sombres) ne sont pas touchés.
      const l = luma(nr, ng, nb);
      const chroma = Math.max(nr, ng, nb) - Math.min(nr, ng, nb);
      const papier = lisser(PAPIER_DEBUT, PAPIER_FIN, rapport) * (1 - lisser(PAPIER_CHROMA_MIN, PAPIER_CHROMA_MAX, chroma));
      const sat = SATURATION_MAGIC * (1 - papier);
      // Papier franchement clair : blanc pur (255), pas 252 à cause d'un canal limité au gain max.
      const blanc = papier * lisser(0.85, 1, cibleY / 255);
      const mr = l + (nr - l) * sat;
      const mg = l + (ng - l) * sat;
      const mb = l + (nb - l) * sat;
      sortie[o] = mr + (255 - mr) * blanc;
      sortie[o + 1] = mg + (255 - mg) * blanc;
      sortie[o + 2] = mb + (255 - mb) * blanc;
      sortie[o + 3] = 255;
    }
  }
  return { data: sortie, width: w, height: h };
}
