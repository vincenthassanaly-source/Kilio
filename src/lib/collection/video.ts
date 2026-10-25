// Dispatcher générique des liens vidéo du module Collection : détecte la
// plateforme (TikTok ou YouTube) à partir de l'URL et délègue à la logique
// dédiée (tiktok.ts / youtube.ts). Permet un champ d'ajout unique et un
// partage natif commun aux deux plateformes.

import { estHoteTiktok, recupererMetadonneesTiktok, resoudreUrlCanoniqueTiktok, TIKTOK_URL_IN_TEXT_PATTERN } from "./tiktok";
import { estHoteYoutube, recupererMetadonneesYoutube, YOUTUBE_URL_IN_TEXT_PATTERN } from "./youtube";

export type TypeVideo = "tiktok" | "youtube";

export function estTypeVideo(type: string): type is TypeVideo {
  return type === "tiktok" || type === "youtube";
}

/** Détecte la plateforme d'un lien vidéo par son hostname. */
export function detecterTypeVideo(url: string): TypeVideo | null {
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

/** Comme `recupererMetadonneesVideo`, mais ne perd jamais le lien : si la
 * récupération des métadonnées échoue (timeout, blocage réseau de la
 * plateforme), renvoie le lien brut avec une miniature et un titre vides pour
 * qu'il puisse quand même être rangé dans une collection. `null` seulement si
 * la plateforme n'est pas reconnue. */
export async function recupererMetadonneesVideoOuLien(url: string): Promise<MetadonneesVideo | null> {
  const metadonnees = await recupererMetadonneesVideo(url);
  if (metadonnees) return metadonnees;
  const type = detecterTypeVideo(url);
  if (!type) return null;
  // Un lien court TikTok ne peut pas être lu par le lecteur : on enregistre
  // l'URL complète quand elle se résout.
  const canonique = type === "tiktok" ? await resoudreUrlCanoniqueTiktok(url) : null;
  return { type, url: canonique?.href ?? url, thumbnailUrl: "", titre: "" };
}
