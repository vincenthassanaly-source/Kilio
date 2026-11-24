// Passerelle entre les algorithmes purs (geometrie, detection, filtres) et les
// API du navigateur (canvas, createImageBitmap, flux vidéo). Côté client
// uniquement : ne jamais importer depuis un composant serveur.

import { detecterQuadrilatere, reduirePourDetection } from "./detection";
import type { MoteurDirect } from "./suivi";
import { aplatirLesLignes } from "./aplatissage";
import { nettoyerLesBords, rognerLeLisere } from "./bordsPropres";
import { effacerLesIntrusions } from "./intrusions";
import { redresserParTranches } from "./redressementPage";
import { redresserLesLignes } from "./redressementTexte";
import { magicColor, type Filtre } from "./filtres";
import { mettreAEchelle, redresser, tailleSortie, type ImageDataLike, type Quad } from "./geometrie";
import { capturerPhotoPleine, captureurDuNavigateur } from "./capture";
import { chargerOpenCv, openCvSiPret, type Cv } from "./opencv";
import { detecterDocumentCv, redresserCv } from "./opencvScan";
import { detecterPhoto } from "./pipeline";

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

/** Côté analysé par OpenCV en direct. */
const COTE_LIVE_OPENCV_PX = 360;
/**
 * Côté analysé par la détection maison en direct, avant qu'OpenCV soit prêt. L'image est d'abord
 * tirée du flux au double de cette taille, puis réduite par moyenne de blocs : un `drawImage` direct
 * à 180 px replie les détails (texte, grain) et faisait s'accrocher le cadre à une ligne de texte.
 */
const COTE_LIVE_MAISON_PX = 240;

/** Vrai si le navigateur demande d'économiser les données (Chrome Android « Économiseur de données »). */
export function economieDeDonnees(): boolean {
  if (typeof navigator === "undefined") return false;
  const connexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connexion?.saveData === true;
}

/** Lance le chargement d'OpenCV en tâche de fond (le scanner reste utilisable sans). */
export function prechargerOpenCv(): void {
  chargerOpenCv().catch(() => {
    // Hors ligne au premier usage ou mémoire insuffisante : l'ancien pipeline prend le relais.
  });
}

/**
 * Préchargement dès l'ouverture de /scanner, pendant un temps libre du navigateur (repli sur un
 * délai court où `requestIdleCallback` n'existe pas, comme Safari). Rien n'est téléchargé si
 * l'utilisateur a demandé d'économiser les données : OpenCV se chargera alors à l'ouverture du viseur.
 * Renvoie une fonction d'annulation (démontage avant le temps libre).
 */
export function prechargerOpenCvSiPossible(): () => void {
  if (economieDeDonnees()) return () => {};
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(() => prechargerOpenCv(), { timeout: 1500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(prechargerOpenCv, 200);
  return () => window.clearTimeout(id);
}

/**
 * Délai au-delà duquel le recadrage n'attend plus OpenCV (premier usage en réseau lent) : le cadre de
 * la détection maison est proposé tout de suite, puis remplacé si OpenCV arrive. Avec le calcul du
 * cadre maison (≈ 0,1 à 0,3 s sur une photo de 3000 px), un cadre s'affiche en moins de 1,5 s.
 */
const ATTENTE_OPENCV_RECADRAGE_MS = 1000;

/**
 * Coins du document sur une photo entière : OpenCV si disponible, sinon l'ancienne
 * détection. Ne rejette jamais ; null = rien de fiable (cadre par défaut à ajuster).
 * La chaîne elle-même est pure (pipeline.ts) : les bancs d'essai la rejouent sous Node.
 *
 * Si OpenCV n'est pas prêt après `delaiMs`, le cadre maison est renvoyé sans attendre ; quand OpenCV
 * arrive, la chaîne complète est rejouée et son cadre passé à `surAmelioration` (à l'appelant de ne
 * pas écraser un coin que l'utilisateur a déjà déplacé).
 */
export async function detecterFeuilleAuto(
  source: ImageDataLike,
  options: { delaiMs?: number; surAmelioration?: (quad: Quad) => void } = {}
): Promise<Quad | null> {
  const { delaiMs = ATTENTE_OPENCV_RECADRAGE_MS, surAmelioration } = options;
  const chargement = chargerOpenCv().then(
    ({ cv }) => ({ cv }),
    () => ({ cv: null as Cv | null })
  );
  let minuteur = 0;
  const delai = new Promise<"delai">((resolve) => {
    minuteur = window.setTimeout(() => resolve("delai"), delaiMs);
  });
  const premier = await Promise.race([chargement, delai]);
  window.clearTimeout(minuteur);
  if (premier !== "delai") return detecterPhoto(premier.cv, source);

  // OpenCV en retard : cadre maison tout de suite, cadre OpenCV plus tard s'il arrive.
  const rapide = await detecterPhoto(null, source);
  chargement
    .then(async ({ cv }) => (cv ? detecterPhoto(cv, source) : null))
    .then((quad) => {
      if (quad) surAmelioration?.(quad);
    })
    .catch(() => {
      // OpenCV en échec : le cadre maison reste.
    });
  return rapide;
}

/**
 * Prise de vue au clic : vraie photo pleine résolution avec mise au point quand le navigateur sait
 * la prendre (Chrome Android), sinon image du flux vidéo. Ne rejette jamais à cause de la photo.
 */
export function capturerPhoto(video: HTMLVideoElement, piste: MediaStreamTrack | null): Promise<ImageData> {
  return capturerPhotoPleine(piste, captureurDuNavigateur(), (photo) => chargerImage(photo), () => capturerImage(video));
}

/** Image courante de la vidéo réduite à `coteMax` (lissage de qualité quand le navigateur le propose). */
function imageReduite(video: HTMLVideoElement, coteMax: number): ImageData {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const echelle = Math.min(1, coteMax / Math.max(vw, vh));
  const w = Math.max(8, Math.round(vw * echelle));
  const h = Math.max(8, Math.round(vh * echelle));
  const canvas = creerCanvas(w, h);
  const ctx = contexte(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Détection en direct sur une image de la vidéo (petite, donc rapide). Coins dans le repère natif du
 * flux ; `pas` = taille d'un pixel de l'image analysée, en pixels du flux (zone morte du suivi).
 */
export function detecterDepuisVideo(
  video: HTMLVideoElement
): { quad: Quad | null; largeur: number; hauteur: number; moteur: MoteurDirect; pas: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const cv = openCvSiPret();
  if (cv) {
    const img = imageReduite(video, COTE_LIVE_OPENCV_PX);
    let quad: Quad | null = null;
    try {
      quad = detecterDocumentCv(cv, img, COTE_LIVE_OPENCV_PX);
    } catch {
      // Échec ponctuel d'OpenCV : pas de cadre pour cette image.
    }
    const pas = vw / img.width;
    return { quad: quad ? mettreAEchelle(quad, pas) : null, largeur: vw, hauteur: vh, moteur: "opencv", pas };
  }
  const tiree = imageReduite(video, 2 * COTE_LIVE_MAISON_PX);
  const { image, facteur } = reduirePourDetection(tiree, COTE_LIVE_MAISON_PX);
  const quad = detecterQuadrilatere(image);
  const pas = facteur * (vw / tiree.width);
  return { quad: quad ? mettreAEchelle(quad, pas) : null, largeur: vw, hauteur: vh, moteur: "maison", pas };
}

export type PageTraitee = {
  /** Page redressée, sans filtre (pour revenir à « Original »). */
  redresse: Blob;
  /** Page après filtre : c'est elle qui est exportée. */
  traite: Blob;
  largeur: number;
  hauteur: number;
  /** Filtre appliqué : toujours « Magique ». */
  filtre: Filtre;
};

/** Redresse la perspective puis applique le filtre « Magique » (rendu CamScanner Magique Pro). */
export async function creerPage(source: ImageDataLike, quad: Quad): Promise<PageTraitee> {
  // Proportions réelles de la page (perspective corrigée), d'après la position des coins dans la photo.
  const { largeur, hauteur } = tailleSortie(quad, undefined, { largeur: source.width, hauteur: source.height });
  let redressee: ImageDataLike | null = null;
  try {
    const { cv } = await chargerOpenCv();
    redressee = redresserCv(cv, source, quad, largeur, hauteur);
  } catch {
    // OpenCV indisponible : redressement bilinéaire maison.
  }
  redressee ??= redresser(source, quad, largeur, hauteur);
  if (!redressee) throw new Error("Cadrage invalide : les quatre coins doivent former un quadrilatère convexe.");
  // Fond resté dans un coin (page coupée par la photo) repeint en papier, puis lignes de texte
  // nettement penchées remises à l'horizontale. Sans fond ni texte repérables, rien ne bouge.
  // Éventail des lignes et marge qui penche (papier courbé, perspective) : redressement local d'après le
  // texte, avant la rotation globale qui ne fait que corriger ce qui reste.
  // Bande de fond et doigt effacés au bord, puis lignes aplaties une par une (pli, courbure), avant la
  // rotation globale qui ne fait que corriger ce qui reste.
  // Fine marge rognée : le pixel du bord mélange papier et table, « Magique » en faisait un liseré gris.
  redressee = rognerLeLisere(redressee);
  redressee = redresserLesLignes(aplatirLesLignes(redresserParTranches(effacerLesIntrusions(nettoyerLesBords(redressee)))));
  const redresse = await imageVersJpeg(redressee);
  const traite = await imageVersJpeg(magicColor(redressee));
  return { redresse, traite, largeur: redressee.width, hauteur: redressee.height, filtre: "magic" };
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
