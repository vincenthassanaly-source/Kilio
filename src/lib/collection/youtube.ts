// Logique pure liée aux liens YouTube du module Collection : validation,
// extraction de l'id vidéo et récupération des métadonnées via l'endpoint
// oEmbed public de YouTube. Contrairement à TikTok, l'id vidéo est toujours
// présent dans l'URL (y compris pour les liens courts youtu.be) : aucune
// résolution de redirection n'est nécessaire.

// Sans délai max, un YouTube qui ne répond pas bloquerait l'action serveur
// jusqu'au timeout de la fonction.
const DELAI_REQUETE_MS = 5000;

const VIDEO_ID_FORMAT = /^[\w-]{6,}$/;
const PATH_ID_PATTERN = /^\/(?:shorts|embed|live)\/([\w-]+)/;
export const YOUTUBE_URL_IN_TEXT_PATTERN =
  /https?:\/\/(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/\S+/i;

export function estHoteYoutube(hostname: string): boolean {
  return (
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "music.youtube.com" ||
    hostname === "youtu.be"
  );
}

function parserUrlYoutube(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return estHoteYoutube(parsed.hostname) ? parsed : null;
  } catch {
    return null;
  }
}

/** Valide un lien YouTube et en extrait l'id vidéo depuis `/watch?v=`,
 * `/shorts/<id>`, `/embed/<id>`, `/live/<id>` ou `youtu.be/<id>`. */
export function extraireIdVideoYoutube(url: string): string | null {
  const parsed = parserUrlYoutube(url);
  if (!parsed) return null;

  let id: string | null | undefined;
  if (parsed.hostname === "youtu.be") {
    id = parsed.pathname.split("/")[1];
  } else if (parsed.pathname === "/watch") {
    id = parsed.searchParams.get("v");
  } else {
    id = parsed.pathname.match(PATH_ID_PATTERN)?.[1];
  }

  return id && VIDEO_ID_FORMAT.test(id) ? id : null;
}

export type MetadonneesYoutube = { url: string; thumbnailUrl: string; titre: string };

/** Récupère les métadonnées (miniature, titre) d'une vidéo YouTube via son
 * endpoint oEmbed public. Ne lève jamais : retourne `null` si le lien n'est
 * pas un lien YouTube valide ou si l'appel échoue, même contrat que
 * recupererMetadonneesTiktok. */
export async function recupererMetadonneesYoutube(url: string): Promise<MetadonneesYoutube | null> {
  const parsed = parserUrlYoutube(url);
  if (!parsed || !extraireIdVideoYoutube(url)) return null;

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.href)}&format=json`,
      { signal: AbortSignal.timeout(DELAI_REQUETE_MS) }
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { thumbnail_url?: unknown; title?: unknown };
    if (typeof data.thumbnail_url !== "string") return null;

    return {
      url: parsed.href,
      thumbnailUrl: data.thumbnail_url,
      titre: typeof data.title === "string" ? data.title : "",
    };
  } catch {
    return null;
  }
}
