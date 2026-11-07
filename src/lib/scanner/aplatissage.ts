// Aplatissage d'une page de texte : chaque ligne redevient horizontale, même quand le papier est
// plié ou courbé. Pur, sans DOM.
//
// Un papier plié (pli en V au pied de page), courbé ou photographié de biais donne des lignes qui
// montent, puis redescendent. Une rotation ou un cisaillement par fenêtre ne peut pas les corriger :
// il faut déformer la page ligne par ligne, comme le fait CamScanner.
//
// Méthode :
// 1. Les pixels d'encre sont reliés horizontalement (les mots d'une ligne se touchent) puis regroupés
//    en lignes de texte (composantes connexes longues et fines).
// 2. Chaque ligne est découpée en colonnes étroites ; le centre de l'encre de chaque colonne donne la
//    forme de la ligne. La ligne cible est horizontale, à la hauteur médiane de la ligne.
// 3. L'écart (vertical) entre la forme mesurée et la ligne cible est lissé sur toute la page par une
//    régression locale pondérée (les lignes proches pèsent plus), ce qui donne un champ de déplacement.
// 4. La page est rééchantillonnée selon ce champ.
//
// Garde-fous : il faut assez de lignes mesurables ; une page dont les lignes sont seulement inclinées
// (rotation d'ensemble) n'est pas touchée, la rotation globale s'en charge ; après la correction on
// mesure à nouveau, et si la page n'est pas nettement plus droite on la garde telle quelle.

import type { ImageDataLike } from "./geometrie";
import { couleurPapier, encreDe, type Encre } from "./redressementTexte";

/** Trous (part de la largeur) comblés entre deux mots pour relier une ligne. */
const TROU_MOTS = 0.025;
/** Une ligne de texte : au moins cette part de la largeur, et pas plus épaisse que cette part de la hauteur. */
const LARGEUR_LIGNE_MIN = 0.15;
const EPAISSEUR_LIGNE_MAX = 0.035;
/** Largeur d'une colonne de mesure (part de la largeur) et nombre minimal de pixels d'encre pour qu'elle compte. */
const LARGEUR_COLONNE = 0.03;
const ENCRE_COLONNE_MIN = 12;
/** Colonnes mesurables minimales pour qu'une ligne compte, et lignes minimales pour que la page soit exploitable. */
const COLONNES_MIN = 5;
const LIGNES_MIN = 4;
/** Écart-type (part de la hauteur) des lignes autour de leur meilleure droite commune, sous lequel la page n'a rien à corriger. */
const COURBURE_MIN = 0.004;
/** Portée de la régression locale (parts de la largeur et de la hauteur) et rappel vers une pente nulle. */
const PORTEE_X = 0.1;
const PORTEE_Y = 0.03;
const RAPPEL_PENTE = 0.04;
/** Pas de la grille du champ de déplacement (pixels de l'image d'analyse). */
const PAS_GRILLE = 24;
/** Déplacement maximal accepté (part de la hauteur) : au-delà, la mesure est jugée aberrante. */
const DEPLACEMENT_MAX = 0.1;
/** Après correction, la courbure restante doit passer sous cette part de la courbure initiale. */
const AMELIORATION_MAX = 0.6;

type Ligne = { xs: number[]; yc: number[] };
type Echantillon = { x: number; y: number; d: number };

const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/** Lignes de texte d'une page : forme (centre de l'encre par colonne) de chacune. */
function lignesDe(e: Encre): Ligne[] {
  const { largeur: w, hauteur: h } = e;
  const masque = new Uint8Array(w * h);
  for (let k = 0; k < e.xs.length; k++) {
    const x = Math.round(e.xs[k]);
    const y = Math.round(e.ys[k]);
    if (x >= 0 && x < w && y >= 0 && y < h) masque[y * w + x] = 1;
  }

  // Les mots d'une même ligne se touchent : on comble les petits trous horizontaux.
  const lie = Uint8Array.from(masque);
  const trou = Math.max(2, Math.round(TROU_MOTS * w));
  for (let y = 0; y < h; y++) {
    let dernier = -1e9;
    for (let x = 0; x < w; x++) {
      if (!masque[y * w + x]) continue;
      if (x - dernier > 1 && x - dernier <= trou) lie.fill(1, y * w + dernier + 1, y * w + x);
      dernier = x;
    }
  }

  // Composantes connexes (8 voisins) : une par ligne de texte.
  const etiquette = new Int32Array(w * h);
  const file = new Int32Array(w * h);
  const gardees: number[] = [];
  let nb = 0;
  for (let depart = 0; depart < lie.length; depart++) {
    if (!lie[depart] || etiquette[depart]) continue;
    nb++;
    let tete = 0, queue = 0;
    file[queue++] = depart;
    etiquette[depart] = nb;
    let minX = w, maxX = 0;
    while (tete < queue) {
      const i = file[tete++];
      const x = i % w;
      const y = (i - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (lie[j] && !etiquette[j]) {
            etiquette[j] = nb;
            file[queue++] = j;
          }
        }
      }
    }
    const largeurLigne = maxX - minX + 1;
    if (largeurLigne >= LARGEUR_LIGNE_MIN * w && queue / largeurLigne <= EPAISSEUR_LIGNE_MAX * h) gardees.push(nb);
  }
  if (gardees.length === 0) return [];

  // Centre de l'encre par colonne, pour chaque ligne gardée.
  const rang = new Map<number, number>();
  gardees.forEach((n, i) => rang.set(n, i));
  const largeurCol = Math.max(2, LARGEUR_COLONNE * w);
  const cols = Math.ceil(w / largeurCol);
  const somme = new Float64Array(gardees.length * cols);
  const compte = new Uint32Array(gardees.length * cols);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!masque[i]) continue;
      const r = rang.get(etiquette[i]);
      if (r === undefined) continue;
      const c = Math.min(cols - 1, Math.floor(x / largeurCol));
      somme[r * cols + c] += y;
      compte[r * cols + c]++;
    }
  }

  const lignes: Ligne[] = [];
  for (let r = 0; r < gardees.length; r++) {
    const xs: number[] = [];
    const brut: number[] = [];
    for (let c = 0; c < cols; c++) {
      const n = compte[r * cols + c];
      if (n < ENCRE_COLONNE_MIN) continue;
      xs.push((c + 0.5) * largeurCol);
      brut.push(somme[r * cols + c] / n);
    }
    if (xs.length < COLONNES_MIN) continue;
    // Médiane glissante sur 3 colonnes : un jambage ou un accent isolé ne tire pas la ligne.
    const yc = brut.map((_, i) => mediane(brut.slice(Math.max(0, i - 1), Math.min(brut.length, i + 2))));
    lignes.push({ xs, yc });
  }
  return lignes;
}

/** Échantillons du champ : en chaque colonne de chaque ligne, l'écart entre la ligne mesurée et la ligne cible horizontale. */
function echantillonsDe(lignes: Ligne[]): Echantillon[] {
  const resultat: Echantillon[] = [];
  for (const l of lignes) {
    const cible = mediane(l.yc);
    l.xs.forEach((x, i) => resultat.push({ x, y: cible, d: l.yc[i] - cible }));
  }
  return resultat;
}

/** Écart-type des échantillons autour de leur meilleure droite commune d = a + b·x (une rotation d'ensemble n'est pas de la courbure). */
function courbureDe(echantillons: Echantillon[]): number {
  const n = echantillons.length;
  let sx = 0, sd = 0, sxx = 0, sxd = 0;
  for (const s of echantillons) {
    sx += s.x; sd += s.d; sxx += s.x * s.x; sxd += s.x * s.d;
  }
  const det = n * sxx - sx * sx;
  const b = det > 0 ? (n * sxd - sx * sd) / det : 0;
  const a = (sd - b * sx) / n;
  let carres = 0;
  for (const s of echantillons) carres += (s.d - (a + b * s.x)) ** 2;
  return Math.sqrt(carres / n);
}

/** Champ de déplacement vertical sur une grille : régression locale pondérée (écart = a + b·dx) en chaque nœud. */
function champDe(echantillons: Echantillon[], w: number, h: number): { valeurs: Float32Array; gx: number; gy: number } {
  const gx = Math.ceil(w / PAS_GRILLE) + 1;
  const gy = Math.ceil(h / PAS_GRILLE) + 1;
  const valeurs = new Float32Array(gx * gy);
  const sx = PORTEE_X * w;
  const sy = PORTEE_Y * h;
  const rappel = (RAPPEL_PENTE * w) ** 2;
  const max = DEPLACEMENT_MAX * h;
  // Une extrapolation (bout de ligne, zone vide) ne dépasse jamais de beaucoup les écarts réellement mesurés.
  let plusBas = 0, plusHaut = 0;
  for (const s of echantillons) {
    if (s.d < plusBas) plusBas = s.d;
    if (s.d > plusHaut) plusHaut = s.d;
  }
  const marge = 0.01 * h;
  const borneBasse = Math.max(-max, plusBas - marge);
  const borneHaute = Math.min(max, plusHaut + marge);
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      const xn = i * PAS_GRILLE;
      const yn = j * PAS_GRILLE;
      let sw = 0, st = 0, stt = 0, sd = 0, std = 0;
      for (const s of echantillons) {
        const dx = s.x - xn;
        const dy = s.y - yn;
        const poids = Math.exp(-0.5 * ((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy)));
        if (poids < 1e-12) continue;
        sw += poids; st += poids * dx; stt += poids * dx * dx; sd += poids * s.d; std += poids * dx * s.d;
      }
      if (sw < 1e-10) continue;
      const r = sw * rappel;
      const det = sw * (stt + r) - st * st;
      const a = det > 0 ? ((stt + r) * sd - st * std) / det : sd / sw;
      valeurs[j * gx + i] = Math.max(borneBasse, Math.min(borneHaute, a));
    }
  }
  return { valeurs, gx, gy };
}

/** Lit le champ (interpolation bilinéaire) au point (x, y) de l'image d'analyse. */
function lireChamp(c: { valeurs: Float32Array; gx: number; gy: number }, x: number, y: number): number {
  const fx = Math.min(c.gx - 1, Math.max(0, x / PAS_GRILLE));
  const fy = Math.min(c.gy - 1, Math.max(0, y / PAS_GRILLE));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(c.gx - 1, x0 + 1);
  const y1 = Math.min(c.gy - 1, y0 + 1);
  const ax = fx - x0;
  const ay = fy - y0;
  const v = c.valeurs;
  return (v[y0 * c.gx + x0] * (1 - ax) + v[y0 * c.gx + x1] * ax) * (1 - ay) + (v[y1 * c.gx + x0] * (1 - ax) + v[y1 * c.gx + x1] * ax) * ay;
}

/**
 * Aplatit la page : chaque ligne de texte devient horizontale, y compris sur un papier plié ou courbé.
 * Renvoie `img` elle-même, sans copie, quand il n'y a rien à corriger (peu de texte, lignes seulement
 * inclinées) ou que la correction n'améliore pas nettement la page.
 */
export function aplatirLesLignes(img: ImageDataLike): ImageDataLike {
  const e = encreDe(img);
  const lignes = lignesDe(e);
  if (lignes.length < LIGNES_MIN) return img;
  const echantillons = echantillonsDe(lignes);
  const avant = courbureDe(echantillons);
  if (avant < COURBURE_MIN * e.hauteur) return img;

  const champ = champDe(echantillons, e.largeur, e.hauteur);
  const { data, width: w, height: h } = img;
  const facteur = e.facteur;
  const [fr, fg, fb] = couleurPapier(img);
  const sortie = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sy = y + lireChamp(champ, x / facteur, y / facteur) * facteur;
      const o = (y * w + x) * 4;
      if (sy < 0 || sy > h - 1) {
        sortie[o] = fr; sortie[o + 1] = fg; sortie[o + 2] = fb; sortie[o + 3] = 255;
        continue;
      }
      const y0 = Math.floor(sy);
      const y1 = Math.min(h - 1, y0 + 1);
      const ay = sy - y0;
      for (let k = 0; k < 3; k++) sortie[o + k] = data[(y0 * w + x) * 4 + k] * (1 - ay) + data[(y1 * w + x) * 4 + k] * ay;
      sortie[o + 3] = 255;
    }
  }
  const resultat: ImageDataLike = { data: sortie, width: w, height: h };

  // Contrôle : on garde la correction seulement si la page est nettement plus droite.
  const eApres = encreDe(resultat);
  const apres = lignesDe(eApres);
  if (apres.length < LIGNES_MIN) return img;
  if (courbureDe(echantillonsDe(apres)) > AMELIORATION_MAX * avant) return img;
  return resultat;
}
