// Passerelle entre les algorithmes purs (geometrie, detection, filtres) et les
// API du navigateur (canvas, createImageBitmap, flux vidéo). Côté client
// uniquement : ne jamais importer depuis un composant serveur.

import { detecterFeuille, detecterQuadrilatere } from "./detection";
import { etendreAuxBordsDeLaFeuille } from "./extension";
import type { Filtre } from "./filtres";
import { appliquerFiltre, filtreConseille } from "./filtres";
import { mettreAEchelle, redresser, tailleSortie, type ImageDataLike, type Quad } from "./geometrie";
import { capturerPhotoPleine, captureurDuNavigateur } from "./capture";
import { chargerOpenCv, openCvSiPret } from "./opencv";
import { detecterDocumentCv, detecterDocumentRobuste, redresserCv } from "./opencvScan";

/** Plus grand côté d'une photo chargée : borne la mémoire des téléphones. */
const COTE_MAX_SOURCE_PX = 3000;
/** Qualité JPEG des pages gardées dans le brouillon. */
const QUALITE_BROUILLON = 0.92;

function creerCanvas(largeur: number, hauteur: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  return canvas;
}

function contexte(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponible");
  return ctx;
}

function versBlob(canvas: HTMLCanvasElement, qualite: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encodage JPEG impossible"))),
      "image/jpeg",
      qualite
    );
  });
}

/** Charge une image (orientation EXIF appliquée), réduite à `coteMax`. */
export async function chargerImage(blob: Blob, coteMax = COTE_MAX_SOURCE_PX): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const echelle = Math.min(1, coteMax / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * echelle));
    const h = Math.max(1, Math.round(bitmap.height * echelle));
    const canvas = creerCanvas(w, h);
    const ctx = contexte(canvas);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } finally {
    bitmap.close();
  }
}

/** Image → JPEG (utilisé pour afficher la source dans l'écran de recadrage). */
export async function imageVersJpeg(img: ImageDataLike, qualite = QUALITE_BROUILLON): Promise<Blob> {
  const canvas = creerCanvas(img.width, img.height);
  const ctx = contexte(canvas);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return versBlob(canvas, qualite);
}

/** Image courante de la vidéo → image (taille native du flux). */
function capturerImage(video: HTMLVideoElement): ImageData {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const canvas = creerCanvas(w, h);
  const ctx = contexte(canvas);
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Côté analysé par OpenCV en direct : plus fin que l'ancien pipeline, qui plafonnait à 180 px. */
const COTE_LIVE_OPENCV_PX = 360;

/** Lance le chargement d'OpenCV en tâche de fond (le scanner reste utilisable sans). */
export function prechargerOpenCv(): void {
  chargerOpenCv().catch(() => {
    // Hors ligne au premier usage ou mémoire insuffisante : l'ancien pipeline prend le relais.
  });
}

/**
 * Coins du document sur une photo entière : OpenCV si disponible, sinon l'ancienne
 * détection. Ne rejette jamais ; null = rien de fiable (cadre par défaut à ajuster).
 */
export async function detecterFeuilleAuto(source: ImageDataLike): Promise<Quad | null> {
  const quad = await detecterCoins(source);
  // Une page qui déborde du cadre est souvent résumée à un pli ou à son bloc de texte : on
  // repousse chaque côté jusqu'au vrai bord du papier (voir extension.ts).
  return quad ? etendreAuxBordsDeLaFeuille(source, quad) : null;
}

async function detecterCoins(source: ImageDataLike): Promise<Quad | null> {
  try {
    const { cv } = await chargerOpenCv();
    // L'ancienne détection par droites (rapide, insensible au grain du fond) vote avec les
    // analyses OpenCV : elle sauve les fonds texturés où les contours échouent.
    const vieux = detecterFeuille(source);
    const quad = await detecterDocumentRobuste(cv, source, { supplementaires: vieux ? [vieux] : [] });
    if (quad) return quad;
  } catch {
    // OpenCV indisponible ou en échec : voir ci-dessous.
  }
  return detecterFeuille(source);
}

/**
 * Prise de vue au clic : vraie photo pleine résolution avec mise au point quand le navigateur sait
 * la prendre (Chrome Android), sinon image du flux vidéo. Ne rejette jamais à cause de la photo.
 */
export function capturerPhoto(video: HTMLVideoElement, piste: MediaStreamTrack | null): Promise<ImageData> {
  return capturerPhotoPleine(piste, captureurDuNavigateur(), (photo) => chargerImage(photo), () => capturerImage(video));
}

/** Détection en direct sur une image de la vidéo (petite, donc rapide). */
export function detecterDepuisVideo(
  video: HTMLVideoElement,
  coteMax: number
): { quad: Quad | null; largeur: number; hauteur: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const cv = openCvSiPret();
  if (cv) coteMax = Math.max(coteMax, COTE_LIVE_OPENCV_PX);
  const echelle = Math.min(1, coteMax / Math.max(vw, vh));
  const w = Math.max(8, Math.round(vw * echelle));
  const h = Math.max(8, Math.round(vh * echelle));
  const canvas = creerCanvas(w, h);
  const ctx = contexte(canvas);
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  let quad: Quad | null;
  try {
    quad = cv ? detecterDocumentCv(cv, img, COTE_LIVE_OPENCV_PX) : detecterQuadrilatere(img);
  } catch {
    quad = detecterQuadrilatere(img);
  }
  // Les coins sont ramenés au repère natif de la vidéo (celui de l'overlay SVG).
  return { quad: quad ? mettreAEchelle(quad, vw / w) : null, largeur: vw, hauteur: vh };
}

export type PageTraitee = {
  /** Page redressée, sans filtre (pour revenir à « Original »). */
  redresse: Blob;
  /** Page après filtre : c'est elle qui est exportée. */
  traite: Blob;
  largeur: number;
  hauteur: number;
  /** Filtre appliqué (celui demandé, ou le conseillé selon la forme en mode « auto »). */
  filtre: Filtre;
};

/**
 * Redresse la perspective puis applique le filtre. Avec `"auto"`, le filtre est
 * choisi d'après la forme de la page : « Couleurs fidèles » pour une carte,
 * « Noir & blanc » sinon.
 */
export async function creerPage(source: ImageDataLike, quad: Quad, filtre: Filtre | "auto"): Promise<PageTraitee> {
  const { largeur, hauteur } = tailleSortie(quad);
  let redressee: ImageDataLike | null = null;
  try {
    const { cv } = await chargerOpenCv();
    redressee = redresserCv(cv, source, quad, largeur, hauteur);
  } catch {
    // OpenCV indisponible : redressement bilinéaire maison.
  }
  redressee ??= redresser(source, quad, largeur, hauteur);
  if (!redressee) throw new Error("Cadrage invalide : les quatre coins doivent former un quadrilatère convexe.");
  const choisi: Filtre = filtre === "auto" ? filtreConseille(largeur, hauteur, redressee) : filtre;
  const redresse = await imageVersJpeg(redressee);
  const traite = choisi === "original" ? redresse : await imageVersJpeg(appliquerFiltre(redressee, choisi));
  return { redresse, traite, largeur, hauteur, filtre: choisi };
}

/** Réapplique un filtre sur une page déjà redressée. */
export async function refiltrer(redresse: Blob, filtre: Filtre): Promise<Blob> {
  if (filtre === "original") return redresse;
  const img = await chargerImage(redresse, COTE_MAX_SOURCE_PX);
  return imageVersJpeg(appliquerFiltre(img, filtre));
}

/** Recompresse une page pour l'export (taille et qualité du réglage choisi). */
export async function jpegPourExport(page: Blob, coteMax: number, qualite: number): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(page);
  try {
    const echelle = Math.min(1, coteMax / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * echelle));
    const h = Math.max(1, Math.round(bitmap.height * echelle));
    const canvas = creerCanvas(w, h);
    const ctx = contexte(canvas);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await versBlob(canvas, qualite);
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}
