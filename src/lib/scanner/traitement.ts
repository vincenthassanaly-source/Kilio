// Passerelle entre les algorithmes purs (geometrie, detection, filtres) et les
// API du navigateur (canvas, createImageBitmap, flux vidéo). Côté client
// uniquement : ne jamais importer depuis un composant serveur.

import { detecterQuadrilatere, reduirePourDetection } from "./detection";
import type { Filtre } from "./filtres";
import { appliquerFiltre } from "./filtres";
import { mettreAEchelle, redresser, tailleSortie, type ImageDataLike, type Quad } from "./geometrie";

/** Plus grand côté d'une photo chargée : borne la mémoire des téléphones. */
const COTE_MAX_SOURCE_PX = 2400;
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
export function capturerImage(video: HTMLVideoElement): ImageData {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const canvas = creerCanvas(w, h);
  const ctx = contexte(canvas);
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Détecte la feuille ; coins exprimés dans le repère de `img`. */
export function detecterFeuille(img: ImageDataLike): Quad | null {
  const { image, facteur } = reduirePourDetection(img);
  const quad = detecterQuadrilatere(image);
  return quad ? mettreAEchelle(quad, facteur) : null;
}

/** Détection en direct sur une image de la vidéo (petite, donc rapide). */
export function detecterDepuisVideo(
  video: HTMLVideoElement,
  coteMax: number
): { quad: Quad | null; largeur: number; hauteur: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const echelle = Math.min(1, coteMax / Math.max(vw, vh));
  const w = Math.max(8, Math.round(vw * echelle));
  const h = Math.max(8, Math.round(vh * echelle));
  const canvas = creerCanvas(w, h);
  const ctx = contexte(canvas);
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const quad = detecterQuadrilatere(img);
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
};

/** Redresse la perspective puis applique le filtre. */
export async function creerPage(source: ImageDataLike, quad: Quad, filtre: Filtre): Promise<PageTraitee> {
  const { largeur, hauteur } = tailleSortie(quad);
  const redressee = redresser(source, quad, largeur, hauteur);
  if (!redressee) throw new Error("Cadrage invalide : les quatre coins doivent former un quadrilatère convexe.");
  const redresse = await imageVersJpeg(redressee);
  const traite = filtre === "original" ? redresse : await imageVersJpeg(appliquerFiltre(redressee, filtre));
  return { redresse, traite, largeur, hauteur };
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
