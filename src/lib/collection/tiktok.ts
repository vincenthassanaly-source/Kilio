// Logique pure liée aux liens TikTok du module Collection : validation,
// résolution des liens courts (vm.tiktok.com, vt.tiktok.com) et récupération
// des métadonnées via l'endpoint oEmbed public de TikTok.

// Sans délai max, un TikTok qui ne répond pas bloquerait l'action serveur
// jusqu'au timeout de la fonction.
const DELAI_REQUETE_MS = 5000;

const VIDEO_ID_PATTERN = /\/video\/(\d+)/;
export const TIKTOK_URL_IN_TEXT_PATTERN = /https?:\/\/(?:[\w-]+\.)?tiktok\.com\/\S+/i;

export function estHoteTiktok(hostname: string): boolean {
  return hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");
}

function parserUrlTiktok(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return estHoteTiktok(parsed.hostname) ? parsed : null;
  } catch {
    return null;
  }
}

// Les liens courts (vm.tiktok.com/..., vt.tiktok.com/...) ne portent pas
// l'id vidéo dans l'URL : on suit la redirection pour obtenir la forme
// canonique (`.../@compte/video/<id>`) avant d'en extraire quoi que ce soit.
async function resoudreUrlCanoniqueTiktok(url: string): Promise<URL | null> {
  const parsed = parserUrlTiktok(url);
  if (!parsed) return null;
  if (VIDEO_ID_PATTERN.test(parsed.pathname)) return parsed;

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(DELAI_REQUETE_MS),
    });
    const resolue = parserUrlTiktok(response.url);
    return resolue && VIDEO_ID_PATTERN.test(resolue.pathname) ? resolue : null;
  } catch {
    return null;
  }
}

/** Valide un lien TikTok et en extrait l'id vidéo, en suivant la
 * redirection des liens courts si besoin. */
export async function extraireIdVideoTiktok(url: string): Promise<string | null> {
  const canonique = await resoudreUrlCanoniqueTiktok(url);
  return canonique?.pathname.match(VIDEO_ID_PATTERN)?.[1] ?? null;
}

export type MetadonneesTiktok = { url: string; thumbnailUrl: string; titre: string };

/** Récupère les métadonnées (miniature, titre) d'une vidéo TikTok via son
 * endpoint oEmbed public. Ne lève jamais : retourne `null` si le lien n'est
 * pas un lien TikTok valide ou si l'appel échoue, pour laisser l'appelant
 * produire un message d'erreur lisible côté utilisateur. */
export async function recupererMetadonneesTiktok(url: string): Promise<MetadonneesTiktok | null> {
  const canonique = await resoudreUrlCanoniqueTiktok(url);
  if (!canonique) return null;

  try {
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonique.href)}`, {
      signal: AbortSignal.timeout(DELAI_REQUETE_MS),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { thumbnail_url?: unknown; title?: unknown };
    if (typeof data.thumbnail_url !== "string") return null;

    return {
      url: canonique.href,
      thumbnailUrl: data.thumbnail_url,
      titre: typeof data.title === "string" ? data.title : "",
    };
  } catch {
    return null;
  }
}
