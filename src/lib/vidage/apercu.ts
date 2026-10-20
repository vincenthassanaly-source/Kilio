"use client";

import { dessinerFeuille } from "./dessin";
import { HAUTEUR_TRANCHE, tranchesDeFeuille } from "./transcription";
import { LARGEUR_LOGIQUE, type Trait } from "./traits";

// Aperçu image (PNG) d'une feuille pour le calendrier de relecture : le HAUT de
// la feuille, en portrait 3:4 comme les cases du calendrier, pour qu'il les
// remplisse sans recadrage. Fond clair opaque et encre sombre quel que soit le
// thème, pour rester lisible partout.
const LARGEUR_PX = 480;
const HAUTEUR_PX = 640;
const FOND = "#faf8f3";
const ENCRE = "#1f2937";

/** Fond opaque derrière le dessin, sur TOUT le canvas. */
function peindreFond(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  // Le fond se peint dans le repère du canvas (pixels), pas dans celui du dessin :
  // sous l'échelle du dessin il ne couvrait qu'un coin et le reste restait transparent.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = FOND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Toute la feuille en tranches PNG lisibles (1 px par unité logique, soit 1000 px de large),
 * avec recouvrement, pour la transcription par Gemini. null si la feuille est vide ou le
 * canvas indisponible ; `tronquee` quand la feuille dépasse le nombre maximal de tranches.
 */
export async function genererTranches(traits: Trait[]): Promise<{ blobs: Blob[]; tronquee: boolean } | null> {
  if (traits.length === 0 || typeof document === "undefined") return null;
  const { tops, tronquee } = tranchesDeFeuille(traits);
  const blobs: Blob[] = [];
  for (const top of tops) {
    const canvas = document.createElement("canvas");
    canvas.width = LARGEUR_LOGIQUE;
    canvas.height = HAUTEUR_TRANCHE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    dessinerFeuille(ctx, traits, { echelle: 1, top, dpr: 1, couleur: ENCRE }, HAUTEUR_TRANCHE);
    peindreFond(ctx, canvas);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!blob) return null;
    blobs.push(blob);
  }
  return { blobs, tronquee };
}

/** PNG du haut de la feuille ; null si la feuille est vide ou le canvas indisponible. */
export async function genererApercu(traits: Trait[]): Promise<Blob | null> {
  if (traits.length === 0 || typeof document === "undefined") return null;
  const echelle = LARGEUR_PX / LARGEUR_LOGIQUE;

  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR_PX;
  canvas.height = HAUTEUR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  dessinerFeuille(ctx, traits, { echelle, top: 0, dpr: 1, couleur: ENCRE }, HAUTEUR_PX);
  peindreFond(ctx, canvas);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
