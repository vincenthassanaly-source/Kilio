// Filtres d'image du scanner. Purs, sans DOM.
//
// - « Magic color » : rend le papier blanc et l'encre nette, comme CamScanner.
//   Une balance des blancs *globale* (mêmes gains partout, donc les rapports de
//   couleur sont conservés), puis un gain calculé sur la LUMINANCE seule et
//   appliqué de la même façon aux trois canaux. Diviser chaque canal par son
//   propre fond (ancienne version) décalait les teintes dès que le fond
//   changeait de couleur : c'est ce qui donnait des couleurs fausses.
// - « Noir & blanc » : le rendu document par défaut. Fond d'éclairage estimé par
//   fermeture morphologique puis divisé (ombres et dégradés disparaissent, le
//   papier devient exactement blanc), netteté du texte renforcée, courbe
//   tranchée mais lissée (pas de binarisation dure qui mangerait les traits fins).
// - « Couleurs fidèles » : pour cartes, photos, pièces d'identité. Corrige
//   seulement l'éclairage progressif (une ombre qui traverse la carte) avec un
//   gain doux et borné, sans blanchir ni toucher aux teintes ni au contenu local.

import type { ImageDataLike } from "./geometrie";

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

/** Rapport pixel/fond en dessous duquel le pixel est noir, et au-dessus duquel il est blanc. */
const NOIR = 0.1;
const BLANC = 0.94;
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

/** Courbe tonale : seuil bas/haut, avec une douce courbe en S qui garde le texte pâle lisible. */
function courbeMagic(rapport: number): number {
  const t = Math.min(1, Math.max(0, (rapport - NOIR) / (BLANC - NOIR)));
  return 0.65 * t + 0.35 * t * t * (3 - 2 * t);
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

  // 3. Par pixel : rapport au fond → courbe → même facteur sur les trois canaux.
  const sortie = new Uint8ClampedArray(img.data.length);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      const o = i * 4;
      const rr = r[i] * wbR, gg2 = g[i] * wbG, bb = b[i] * wbB;
      const yy = luma(rr, gg2, bb);
      const rapport = Math.min(1.3, yy / Math.max(24, lire(fond, s, px, py)));
      const cibleY = courbeMagic(rapport) * 255;
      let nr = cibleY, ng = cibleY, nb = cibleY;
      if (yy > 1) {
        let k = cibleY / yy;
        const max = Math.max(rr, gg2, bb);
        if (max * k > 255) k = 255 / max; // pas d'écrêtage d'un seul canal : on garde la teinte
        nr = rr * k; ng = gg2 * k; nb = bb * k;
      }
      // Saturation autour de la luminance obtenue.
      const l = luma(nr, ng, nb);
      sortie[o] = l + (nr - l) * SATURATION_MAGIC;
      sortie[o + 1] = l + (ng - l) * SATURATION_MAGIC;
      sortie[o + 2] = l + (nb - l) * SATURATION_MAGIC;
      sortie[o + 3] = 255;
    }
  }
  return { data: sortie, width: w, height: h };
}

/* ---------- Noir & blanc ---------- */

/** Rapport pixel/fond sous lequel on est noir, et au-dessus duquel on est blanc pur. */
const NB_NOIR = 0.5;
const NB_BLANC = 0.9;
/** Rayon de la fermeture du fond (fraction du plus grand côté de la grille). */
const NB_RAYON_FOND = 0.045;
/** Netteté : rayon du flou de référence (pixels pour 1000 px de côté) et gain. */
const NB_RAYON_NETTETE = 1.2;
const NB_GAIN_NETTETE = 1.1;

/** Courbe en S : encre franche, papier blanc, transition douce (texte pâle encore lisible). */
function courbeNoirEtBlanc(rapport: number): number {
  const t = Math.min(1, Math.max(0, (rapport - NB_NOIR) / (NB_BLANC - NB_NOIR)));
  return t * t * (3 - 2 * t);
}

/** Luminance médiane au-dessous de laquelle la page est un support sombre (carte noire, ardoise). */
const SEUIL_PAGE_SOMBRE = 105;

/** Vrai si la majorité de la page est sombre : le texte y est clair sur fond foncé. */
export function pageSombre(img: ImageDataLike): boolean {
  const { data, width: w, height: h } = img;
  const pas = Math.max(1, Math.floor(Math.sqrt((w * h) / 20000)));
  const histo = new Uint32Array(256);
  let n = 0;
  for (let y = 0; y < h; y += pas) {
    for (let x = 0; x < w; x += pas) {
      const p = (y * w + x) * 4;
      histo[Math.round(luma(data[p], data[p + 1], data[p + 2]))]++;
      n++;
    }
  }
  let cumul = 0;
  for (let v = 0; v < 256; v++) {
    cumul += histo[v];
    if (cumul >= n / 2) return v < SEUIL_PAGE_SOMBRE;
  }
  return false;
}

/**
 * Document en noir et blanc net sur fond uniforme, sans ombres. Sur un support sombre
 * (texte clair sur fond foncé) la polarité est conservée : le fond reste noir pur et
 * le texte blanc, au lieu d'être forcé en noir sur blanc.
 */
export function noirEtBlanc(img: ImageDataLike): ImageDataLike {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const s = Math.max(1, Math.round(Math.max(w, h) / COTE_GRILLE));
  const sombre = pageSombre(img);

  // 1. Luminance pleine résolution (inversée sur un support sombre : le fond devient « papier »)
  //    et fond d'éclairage (l'encre, plus fine que le noyau, disparaît).
  const lum = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const y = luma(data[p], data[p + 1], data[p + 2]);
    lum[i] = sombre ? 255 - y : y;
  }
  const grille = reduireMoyenne(lum, w, h, s);
  const rayon = Math.max(2, Math.round(NB_RAYON_FOND * Math.max(grille.w, grille.h)));
  const fond = flouBoite(extremum(extremum(grille, rayon, true), rayon, false), Math.max(1, Math.round(rayon / 2)));

  // 2. Rapport au fond (≈ 1 sur le papier, bien plus bas sur l'encre).
  const rapport: Grille = { p: new Float32Array(n), w, h };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      rapport.p[i] = Math.min(1.4, lum[i] / Math.max(24, lire(fond, s, x, y)));
    }
  }

  // 3. Netteté (masque flou) : renforce les bords des lettres avant la courbe.
  const r = Math.max(1, Math.round((NB_RAYON_NETTETE * Math.max(w, h)) / 1000));
  const flou = flouBoite(flouBoite(rapport, r), r);

  const sortie = new Uint8ClampedArray(data.length);
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    const net = rapport.p[i] + NB_GAIN_NETTETE * (rapport.p[i] - flou.p[i]);
    const clair = courbeNoirEtBlanc(net) * 255;
    const v = sombre ? 255 - clair : clair;
    sortie[o] = v;
    sortie[o + 1] = v;
    sortie[o + 2] = v;
    sortie[o + 3] = 255;
  }
  return { data: sortie, width: w, height: h };
}

/* ---------- Couleurs fidèles ---------- */

/** Rayon du flou d'éclairage, en fraction du plus grand côté : très large, pour ne suivre que les ombres étendues. */
const RAYON_ECLAIRAGE = 0.2;
/** Force de la correction d'éclairage (0 = rien, 1 = uniformisation complète). */
const FORCE_ECLAIRAGE = 0.65;
/** Bornes du gain d'éclairage : jamais plus de ±30 % de correction. */
const GAIN_MIN = 0.8;
const GAIN_MAX = 1.3;
/** Étirement des niveaux limité, et gain de saturation très léger. */
const ETIREMENT_MAX = 1.2;
const SATURATION_FIDELE = 1.04;

/** Corrige l'éclairage inégal sans toucher aux teintes ni blanchir le contenu. */
export function couleursFideles(img: ImageDataLike): ImageDataLike {
  const { width: w, height: h, data } = img;
  const { r, g, b } = plansRVB(img);
  const s = Math.max(1, Math.round(Math.max(w, h) / COTE_GRILLE));
  const gr = reduireMoyenne(r, w, h, s);
  const gg = reduireMoyenne(g, w, h, s);
  const gb = reduireMoyenne(b, w, h, s);
  const gy: Grille = { p: new Float32Array(gr.p.length), w: gr.w, h: gr.h };
  for (let i = 0; i < gy.p.length; i++) gy.p[i] = luma(gr.p[i], gg.p[i], gb.p[i]);
  const rayon = Math.max(2, Math.round(RAYON_ECLAIRAGE * Math.max(gy.w, gy.h)));
  const eclairage = flouBoite(flouBoite(gy, rayon), Math.max(1, Math.round(rayon / 2)));

  // Niveau de référence : l'éclairage moyen ; chaque pixel est ramené vers lui.
  let moyenne = 0;
  for (let i = 0; i < eclairage.p.length; i++) moyenne += eclairage.p[i];
  moyenne /= eclairage.p.length;

  // Étirement doux : 1er et 99e centiles de la luminance de la grille.
  const bas = percentile(gy.p, 0.01);
  const haut = percentile(gy.p, 0.99);
  const etirement = Math.min(ETIREMENT_MAX, 250 / Math.max(1, haut - bas));

  const sortie = new Uint8ClampedArray(data.length);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const local = Math.max(24, lire(eclairage, s, px, py));
      const gain = Math.min(GAIN_MAX, Math.max(GAIN_MIN, Math.pow(moyenne / local, FORCE_ECLAIRAGE)));
      let nr = data[i] * gain;
      let ng = data[i + 1] * gain;
      let nb = data[i + 2] * gain;
      // Étirement linéaire autour du niveau bas, même gain sur les trois canaux.
      if (etirement > 1.01) {
        nr = (nr - bas) * etirement + bas;
        ng = (ng - bas) * etirement + bas;
        nb = (nb - bas) * etirement + bas;
      }
      const l = luma(nr, ng, nb);
      sortie[i] = l + (nr - l) * SATURATION_FIDELE;
      sortie[i + 1] = l + (ng - l) * SATURATION_FIDELE;
      sortie[i + 2] = l + (nb - l) * SATURATION_FIDELE;
      sortie[i + 3] = 255;
    }
  }
  return { data: sortie, width: w, height: h };
}

/** Rapport longueur/largeur d'une carte au format ID-1 (carte bancaire, d'identité) : 85,6 × 54 mm. */
const RATIO_CARTE = 1.586;
/** Large : la perspective étire ou écrase le rapport apparent d'une carte photographiée de biais. */
const TOLERANCE_CARTE = 0.1;

/**
 * Filtre proposé par défaut selon la forme de la page redressée : une carte ou
 * une pièce d'identité garde ses couleurs, tout le reste (A4, ticket, page de
 * livre) reçoit « Noir & blanc ». L'A4 (1,41) reste bien en dehors de la tolérance.
 */
export function filtreConseille(largeur: number, hauteur: number): Filtre {
  const rapport = Math.max(largeur, hauteur) / Math.max(1, Math.min(largeur, hauteur));
  return Math.abs(rapport - RATIO_CARTE) <= TOLERANCE_CARTE ? "couleurs" : "noirblanc";
}

/** Applique le filtre choisi ; « original » renvoie l'image telle quelle. */
export function appliquerFiltre(img: ImageDataLike, filtre: Filtre): ImageDataLike {
  if (filtre === "noirblanc") return noirEtBlanc(img);
  if (filtre === "magic") return magicColor(img);
  if (filtre === "couleurs") return couleursFideles(img);
  return img;
}
