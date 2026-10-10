// Logique pure liée aux miniatures vidéo du module Collection. Les URLs de
// miniature TikTok sont signées et expirent après quelques jours : on les
// copie dans le bucket Supabase pour qu'elles ne dépendent plus du CDN.

const BUCKET_MARQUEUR = "/collection-images/";

// Hôtes des CDN d'où TikTok sert ses miniatures (oEmbed). Liste fermée : les
// URLs de miniature peuvent venir d'un formulaire (partage natif), le serveur
// ne doit pas télécharger n'importe quelle adresse.
const DOMAINES_CDN_TIKTOK = ["tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "tiktokv.com", "tiktokv.us"];

/** `true` si l'URL pointe déjà vers le bucket de stockage (rien à copier). */
export function estMiniatureStockee(url: string | null | undefined): boolean {
  return !!url && url.includes(BUCKET_MARQUEUR);
}

/** `true` si l'URL est une miniature HTTPS servie par un CDN TikTok connu. */
export function estUrlMiniatureTiktokCopiable(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return DOMAINES_CDN_TIKTOK.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
}
