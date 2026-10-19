"use client";

import { dessinerFeuille } from "./dessin";
import { LARGEUR_LOGIQUE, type Trait } from "./traits";

// Aperçu image (PNG) d'une feuille pour le calendrier de relecture. Fond clair
// opaque et encre sombre quel que soit le thème, pour rester lisible partout.
const LARGEUR_PX = 480;
const HAUTEUR_MAX_LOGIQUE = 3000;
const MARGE_BAS_LOGIQUE = 60;
const FOND = "#faf8f3";
const ENCRE = "#1f2937";

/** PNG de la feuille, recadré sous le dernier trait ; null si la feuille est vide ou le canvas indisponible. */
export async function genererApercu(traits: Trait[]): Promise<Blob | null> {
  if (traits.length === 0 || typeof document === "undefined") return null;
  let maxY = 0;
  for (const { p } of traits) for (let i = 1; i < p.length; i += 3) maxY = Math.max(maxY, p[i]);
  const hauteurLogique = Math.min(HAUTEUR_MAX_LOGIQUE, Math.max(300, maxY + MARGE_BAS_LOGIQUE));
  const echelle = LARGEUR_PX / LARGEUR_LOGIQUE;
  const hauteurPx = Math.ceil(hauteurLogique * echelle);

  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR_PX;
  canvas.height = hauteurPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  dessinerFeuille(ctx, traits, { echelle, top: 0, dpr: 1, couleur: ENCRE }, hauteurPx);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = FOND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
