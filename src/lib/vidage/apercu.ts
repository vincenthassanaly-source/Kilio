"use client";

import { dessinerFeuille } from "./dessin";
import { LARGEUR_LOGIQUE, type Trait } from "./traits";

// Aperçu image (PNG) d'une feuille pour le calendrier de relecture : le HAUT de
// la feuille, en portrait 3:4 comme les cases du calendrier, pour qu'il les
// remplisse sans recadrage. Fond clair opaque et encre sombre quel que soit le
// thème, pour rester lisible partout.
const LARGEUR_PX = 480;
const HAUTEUR_PX = 640;
const FOND = "#faf8f3";
const ENCRE = "#1f2937";

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
  // Le fond se peint dans le repère du canvas (pixels), pas dans celui du dessin :
  // sous l'échelle du dessin il ne couvrait qu'un coin et le reste restait transparent.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = FOND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
