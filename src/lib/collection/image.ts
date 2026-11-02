// Téléchargement d'une image de la collection pour la joindre à une requête
// Gemini. Module serveur (fetch), sans "use server" : ce n'est pas une action.
import { TAILLE_MAX_IMAGE_OCTETS } from "@/lib/collection/titrage";

const TELECHARGEMENT_TIMEOUT_MS = 15_000;

// CDN d'où YouTube et TikTok servent leurs miniatures. Liste fermée : l'adresse
// peut venir d'un formulaire (partage natif), le serveur ne doit pas
// télécharger n'importe quelle URL.
const DOMAINES_CDN = ["ytimg.com", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "tiktokv.com", "tiktokv.us"];

/**
 * `true` si on peut télécharger cette image sans risque : HTTPS, et soit le
 * stockage de l'app (`hoteStockage`), soit un CDN de miniatures connu.
 */
export function estUrlImageAnalysable(url: string, hoteStockage: string | null): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (hoteStockage && parsed.hostname === hoteStockage) return true;
  return DOMAINES_CDN.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
}

/** Nom d'hôte du stockage Supabase de l'app, ou null s'il n'est pas configuré. */
export function hoteStockageApp(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
}

export type ImageGemini = { mimeType: string; data: string };

/** Image à l'adresse donnée, ou null si elle est illisible, trop lourde ou pas une image. */
export async function telechargerImage(url: string | null): Promise<ImageGemini | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(TELECHARGEMENT_TIMEOUT_MS) });
    if (!reponse.ok) return null;
    const type = reponse.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    if (Number(reponse.headers.get("content-length")) > TAILLE_MAX_IMAGE_OCTETS) return null;
    const octets = Buffer.from(await reponse.arrayBuffer());
    if (octets.length > TAILLE_MAX_IMAGE_OCTETS) return null;
    return { mimeType: type.split(";")[0].trim(), data: octets.toString("base64") };
  } catch {
    return null;
  }
}
