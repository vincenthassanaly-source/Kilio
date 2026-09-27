// Dispatcher générique des liens vidéo du module Collection : détecte la
// plateforme (TikTok ou YouTube) à partir de l'URL et délègue à la logique
// dédiée (tiktok.ts / youtube.ts). Permet un champ d'ajout unique et un
// partage natif commun aux deux plateformes.

import { estHoteTiktok, recupererMetadonneesTiktok, TIKTOK_URL_IN_TEXT_PATTERN } from "./tiktok";
import { estHoteYoutube, recupererMetadonneesYoutube, YOUTUBE_URL_IN_TEXT_PATTERN } from "./youtube";

export type TypeVideo = "tiktok" | "youtube";

export function estTypeVideo(type: string): type is TypeVideo {
  return type === "tiktok" || type === "youtube";
}

/** Détecte la plateforme d'un lien vidéo par son hostname. */
function detecterTypeVideo(url: string): TypeVideo | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  if (estHoteTiktok(hostname)) return "tiktok";
  if (estHoteYoutube(hostname)) return "youtube";
  return null;
}

export type MetadonneesVideo = { type: TypeVideo; url: string; thumbnailUrl: string; titre: string };

/** Récupère les métadonnées d'un lien TikTok ou YouTube. Ne lève jamais :
 * retourne `null` si la plateforme n'est pas reconnue ou si la récupération
 * échoue. */
export async function recupererMetadonneesVideo(url: string): Promise<MetadonneesVideo | null> {
  const type = detecterTypeVideo(url);
  if (!type) return null;

  const metadonnees =
    type === "tiktok" ? await recupererMetadonneesTiktok(url) : await recupererMetadonneesYoutube(url);
  return metadonnees ? { type, ...metadonnees } : null;
}

const VIDEO_URL_IN_TEXT_PATTERN = new RegExp(
  `${TIKTOK_URL_IN_TEXT_PATTERN.source}|${YOUTUBE_URL_IN_TEXT_PATTERN.source}`,
  "i"
);

/** Repère un lien TikTok ou YouTube au milieu d'un texte libre (le champ
 * `text` d'un partage natif Android peut contenir d'autres mots autour du
 * lien). */
export function extraireLienVideoDuTexte(texte: string): string | null {
  return texte.match(VIDEO_URL_IN_TEXT_PATTERN)?.[0] ?? null;
}
