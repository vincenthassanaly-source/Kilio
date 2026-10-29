// Fichiers reçus par le partage natif (Web Share Target) et mis de côté par le
// service worker (public/sw.js) dans le cache `kilio-partage-en-attente`, sous
// la clé `/__partage/<id>/<i>`, le temps que l'écran de choix les traite côté
// client (compression, envoi). Lecture et nettoyage partagés par les
// destinations Collection, Tâche et Documents.

// Même nom que dans public/sw.js.
const CACHE_PARTAGE = "kilio-partage-en-attente";

export async function lireFichiersEnAttente(id: string, nb: number): Promise<File[]> {
  const cache = await caches.open(CACHE_PARTAGE);
  const fichiers: File[] = [];
  for (let i = 0; i < nb; i++) {
    const reponse = await cache.match(`/__partage/${id}/${i}`);
    if (!reponse) continue;
    const blob = await reponse.blob();
    const nom = decodeURIComponent(reponse.headers.get("X-Nom-Fichier") ?? `photo-${i + 1}.jpg`);
    fichiers.push(new File([blob], nom, { type: blob.type || "image/jpeg" }));
  }
  return fichiers;
}

/** Types MIME des fichiers en attente, lus dans les en-têtes (sans charger les fichiers). */
export async function lireTypesEnAttente(id: string, nb: number): Promise<string[]> {
  const cache = await caches.open(CACHE_PARTAGE);
  const types: string[] = [];
  for (let i = 0; i < nb; i++) {
    const reponse = await cache.match(`/__partage/${id}/${i}`);
    if (reponse) types.push(reponse.headers.get("Content-Type") ?? "");
  }
  return types;
}

export async function oublierFichiersEnAttente(id: string, nb: number): Promise<void> {
  const cache = await caches.open(CACHE_PARTAGE);
  await Promise.all(Array.from({ length: nb }, (_, i) => cache.delete(`/__partage/${id}/${i}`)));
}
