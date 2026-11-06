// Redressement local d'une page de texte : lignes parallèles et marge gauche verticale. Pur, sans DOM.
//
// Un papier légèrement courbé ou photographié en perspective donne des lignes de texte dont
// l'angle change du haut vers le bas (un éventail, pas forcément linéaire), et une marge gauche
// qui penche. Un redressement de perspective d'après le seul contour de la page ne les corrige pas,
// surtout quand les coins de la page sont hors de la photo.
//
// Méthode : la page est découpée en tranches qui se chevauchent. Dans chacune on mesure l'angle des
// lignes (profil de projection) et la position du bord gauche du texte. On en déduit
// - un cisaillement vertical dépendant de la hauteur : chaque tranche est rendue horizontale ;
// - un cisaillement horizontal : la marge gauche, ajustée par une droite robuste, devient verticale.
// Après la correction on mesure à nouveau : si elle n'améliore pas nettement la page, on la garde telle
// quelle. Sans texte repérable (photo, carte, page vide), rien ne bouge.

import type { ImageDataLike } from "./geometrie";
import { couleurPapier, encreDe, estimerAngleDePoints, type Encre } from "./redressementTexte";

/** La page est découpée en TRANCHES pas ; une fenêtre d'analyse en couvre FENETRE (chevauchement 50 %). */
const TRANCHES = 12;
const FENETRE = 2;
/** Nombre minimal de fenêtres mesurables pour que la page soit jugée exploitable. */
const FENETRES_MIN = 5;
/** Écart (degrés) à partir duquel l'éventail ou le penchement de la marge est corrigé. */
const ECART_MIN_DEG = 0.6;
/** Après correction, l'écart restant doit passer sous cette part de l'écart initial. */
const AMELIORATION_MAX = 0.6;
/** Position du bord gauche du texte : centile des « premières encres » de chaque rangée. */
const CENTILE_MARGE = 0.15;
/** Rangées d'encre minimales pour mesurer la marge d'une fenêtre. */
const RANGEES_MIN = 8;
/** Écart médian maximal à la droite de marge, en part de la largeur : au-delà, la marge n'est pas fiable. */
const RESIDU_MARGE_MAX = 0.012;

const DEG = Math.PI / 180;

const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

type Fenetre = { centre: number; angle: number | null; marge: number | null };

/** Angle des lignes et bord gauche du texte pour chaque fenêtre d'analyse (coordonnées de l'image d'analyse). */
function fenetresDe(e: Encre): Fenetre[] {
  const pas = e.hauteur / TRANCHES;
  const hauteurFenetre = pas * FENETRE;
  const resultat: Fenetre[] = [];
  for (let i = 0; i + FENETRE <= TRANCHES; i++) {
    const y0 = i * pas;
    const y1 = y0 + hauteurFenetre;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k < e.ys.length; k++) {
      if (e.ys[k] >= y0 && e.ys[k] < y1) {
        xs.push(e.xs[k]);
        ys.push(e.ys[k] - y0);
      }
    }
    const part = xs.length / (e.largeur * hauteurFenetre);
    const mesure = estimerAngleDePoints(Float32Array.from(xs), Float32Array.from(ys), e.largeur, hauteurFenetre, part);

    // Bord gauche : pour chaque rangée, la première encre ; on retient un centile bas de ces valeurs.
    const parRangee = new Map<number, { min: number; n: number }>();
    for (let k = 0; k < xs.length; k++) {
      const r = Math.round(ys[k]);
      const cur = parRangee.get(r);
      if (!cur) parRangee.set(r, { min: xs[k], n: 1 });
      else {
        cur.n++;
        if (xs[k] < cur.min) cur.min = xs[k];
      }
    }
    const minima = [...parRangee.values()].filter((r) => r.n >= 2).map((r) => r.min).sort((a, b) => a - b);
    const marge = minima.length >= RANGEES_MIN ? minima[Math.floor(minima.length * CENTILE_MARGE)] : null;

    resultat.push({ centre: y0 + hauteurFenetre / 2, angle: mesure ? mesure.deg : null, marge });
  }
  return resultat;
}

type Etat = {
  /** Angle médian des lignes (degrés) et écart maximal à cette médiane : l'éventail. */
  mediane: number;
  eventail: number;
  /** Pente de la marge gauche (px par px) et son angle en degrés ; null si non mesurable. */
  pente: number | null;
  angleMarge: number | null;
};

/** Résumé d'une page : éventail des lignes et penchement de la marge ; null si trop peu de texte. */
function etatDe(fenetres: Fenetre[], e: Encre): Etat | null {
  const angles = fenetres.map((f) => f.angle).filter((a): a is number => a !== null);
  if (angles.length < FENETRES_MIN) return null;
  const med = mediane(angles);
  const eventail = Math.max(...angles.map((a) => Math.abs(a - med)));

  // Marge : pente de Theil-Sen (médiane des pentes entre paires de fenêtres éloignées).
  const pts = fenetres.filter((f) => f.marge !== null).map((f) => ({ y: f.centre, m: f.marge as number }));
  let pente: number | null = null;
  if (pts.length >= FENETRES_MIN) {
    const pentes: number[] = [];
    const pas = e.hauteur / TRANCHES;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[j].y - pts[i].y >= 2 * pas) pentes.push((pts[j].m - pts[i].m) / (pts[j].y - pts[i].y));
      }
    }
    if (pentes.length >= 3) {
      const b = mediane(pentes);
      const a = mediane(pts.map((p) => p.m - b * p.y));
      const residu = mediane(pts.map((p) => Math.abs(p.m - (a + b * p.y))));
      if (residu <= RESIDU_MARGE_MAX * e.largeur) pente = b;
    }
  }
  return { mediane: med, eventail, pente, angleMarge: pente === null ? null : Math.atan(pente) / DEG };
}

/** Angle des lignes à la hauteur `y` (image d'analyse) : interpolation linéaire entre les fenêtres mesurées. */
function angleAu(fenetres: Fenetre[], y: number): number {
  const mesurees = fenetres.filter((f) => f.angle !== null) as { centre: number; angle: number }[];
  if (y <= mesurees[0].centre) return mesurees[0].angle;
  for (let i = 1; i < mesurees.length; i++) {
    if (y <= mesurees[i].centre) {
      const a = mesurees[i - 1];
      const b = mesurees[i];
      const t = (y - a.centre) / (b.centre - a.centre);
      return a.angle + (b.angle - a.angle) * t;
    }
  }
  return mesurees[mesurees.length - 1].angle;
}

/**
 * Redresse localement la page : lignes de texte horizontales à toute hauteur et marge gauche verticale.
 * Renvoie `img` elle-même, sans copie, quand il n'y a rien à corriger ou que la correction n'améliore
 * pas nettement la page.
 */
export function redresserParTranches(img: ImageDataLike): ImageDataLike {
  const e = encreDe(img);
  const fenetres = fenetresDe(e);
  const avant = etatDe(fenetres, e);
  if (!avant) return img;

  const corrigerLignes = avant.eventail >= ECART_MIN_DEG;
  // Sans correction des lignes, la rotation globale (redressementTexte) s'en chargera et fera aussi
  // tourner la marge : on ne cisaille que ce qui reste après cette rotation.
  const angleMargeACorriger = avant.angleMarge === null ? 0 : corrigerLignes ? avant.angleMarge : avant.angleMarge - avant.mediane;
  const corrigerMarge = avant.angleMarge !== null && Math.abs(angleMargeACorriger) >= ECART_MIN_DEG;
  if (!corrigerLignes && !corrigerMarge) return img;

  const b = corrigerMarge ? Math.tan(angleMargeACorriger * DEG) : 0;
  const { data, width: w, height: h } = img;
  const facteur = e.facteur;
  const centreX = (w - 1) / 2;
  // Pivot du cisaillement de la marge : la rangée qui ne bouge pas. On choisit celle où le décalage
  // reste toujours dirigé vers la GAUCHE : repousser le texte vers la droite le ferait sortir du cadre
  // (la fin des lignes est souvent déjà au bord de la photo), alors qu'à gauche il y a une marge.
  const pivotY = b > 0 ? 0 : h - 1;
  const [fr, fg, fb] = couleurPapier(img);
  const sortie = new Uint8ClampedArray(data.length);

  // Table de l'angle par rangée pleine résolution (évite de réinterpoler pour chaque pixel).
  const tanParRangee = new Float32Array(h);
  for (let y = 0; y < h; y++) tanParRangee[y] = corrigerLignes ? Math.tan(angleAu(fenetres, y / facteur) * DEG) : 0;

  for (let y = 0; y < h; y++) {
    const t = tanParRangee[y];
    for (let x = 0; x < w; x++) {
      const x1 = x + b * (y - pivotY);
      const sy = y + (x1 - centreX) * t;
      const o = (y * w + x) * 4;
      if (x1 < 0 || sy < 0 || x1 > w - 1 || sy > h - 1) {
        sortie[o] = fr; sortie[o + 1] = fg; sortie[o + 2] = fb; sortie[o + 3] = 255;
        continue;
      }
      const x0 = Math.floor(x1);
      const y0 = Math.floor(sy);
      const xb = Math.min(w - 1, x0 + 1);
      const yb = Math.min(h - 1, y0 + 1);
      const ax = x1 - x0;
      const ay = sy - y0;
      for (let k = 0; k < 3; k++) {
        const haut = data[(y0 * w + x0) * 4 + k] * (1 - ax) + data[(y0 * w + xb) * 4 + k] * ax;
        const bas = data[(yb * w + x0) * 4 + k] * (1 - ax) + data[(yb * w + xb) * 4 + k] * ax;
        sortie[o + k] = haut * (1 - ay) + bas * ay;
      }
      sortie[o + 3] = 255;
    }
  }
  const resultat: ImageDataLike = { data: sortie, width: w, height: h };

  // Contrôle : on garde la correction seulement si elle améliore nettement ce qui l'a motivée.
  const eApres = encreDe(resultat);
  const apres = etatDe(fenetresDe(eApres), eApres);
  if (!apres) return img;
  if (corrigerLignes && apres.eventail > AMELIORATION_MAX * avant.eventail) return img;
  if (corrigerMarge) {
    if (apres.angleMarge === null) return img;
    const restant = Math.abs(apres.angleMarge - (corrigerLignes ? 0 : apres.mediane));
    if (restant > AMELIORATION_MAX * Math.abs(angleMargeACorriger)) return img;
  }
  return resultat;
}
