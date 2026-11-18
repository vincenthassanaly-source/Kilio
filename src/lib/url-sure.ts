// Garde-fous sur les adresses qui viennent d'un formulaire ou d'un lien de
// partage : on n'enregistre ni n'affiche d'URL dont le schéma n'est pas
// http(s) (par exemple `javascript:` ou `data:`). Module pur, utilisable
// côté serveur comme côté client.

/** `true` si `url` est une adresse absolue en `http:` ou `https:`. */
export function estUrlHttp(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * `true` si `url` est une adresse HTTP(S) et, quand le nom d'hôte du stockage
 * de l'app est connu, qu'elle pointe bien vers ce stockage.
 */
export function estUrlStockageApp(url: string | null | undefined, hoteStockage: string | null): boolean {
  if (!estUrlHttp(url)) return false;
  if (!hoteStockage) return true;
  return new URL(url as string).hostname === hoteStockage;
}
