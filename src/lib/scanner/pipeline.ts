// Enchaînement de la détection sur une photo, sans DOM ni chargement : `cv` est injecté. C'est
// exactement la chaîne de `detecterFeuilleAuto` (traitement.ts), pour que les bancs d'essai sous
// Node testent la chaîne livrée et pas seulement les détecteurs bruts.

import { affinerLesCotes } from "./affinage";
import { detecterFeuille } from "./detection";
import { etendreAuxBordsDeLaFeuille } from "./extension";
import type { ImageDataLike, Quad } from "./geometrie";
import type { Cv } from "./opencv";
import { detecterDocumentRobuste } from "./opencvScan";

/** Coins bruts : vote OpenCV multi-échelles (avec la détection maison comme voix), sinon la détection maison seule. */
export async function detecterCoinsPhoto(
  cv: Cv | null,
  source: ImageDataLike,
  options: { ceder?: () => Promise<void> } = {}
): Promise<Quad | null> {
  // L'ancienne détection par droites (rapide, insensible au grain du fond) vote avec les
  // analyses OpenCV : elle sauve les fonds texturés où les contours échouent.
  const vieux = detecterFeuille(source);
  if (cv) {
    try {
      const quad = await detecterDocumentRobuste(cv, source, { supplementaires: vieux ? [vieux] : [], ceder: options.ceder });
      if (quad) return quad;
    } catch {
      // OpenCV en échec : la détection maison prend le relais.
    }
  }
  return vieux;
}

/**
 * Cadre final proposé au recadrage. Une page qui déborde du cadre est souvent résumée à un pli ou à
 * son bloc de texte : on repousse chaque côté jusqu'au vrai bord du papier (extension.ts), puis on
 * recale chaque côté sur ce bord pour qu'il soit droit et parallèle au vrai (affinage.ts).
 */
export function finaliserCadre(source: ImageDataLike, quad: Quad): Quad {
  return affinerLesCotes(source, etendreAuxBordsDeLaFeuille(source, quad));
}

/** Chaîne complète d'une photo : coins bruts puis cadre final, ou null si rien de fiable. */
export async function detecterPhoto(
  cv: Cv | null,
  source: ImageDataLike,
  options: { ceder?: () => Promise<void> } = {}
): Promise<Quad | null> {
  const quad = await detecterCoinsPhoto(cv, source, options);
  return quad ? finaliserCadre(source, quad) : null;
}
