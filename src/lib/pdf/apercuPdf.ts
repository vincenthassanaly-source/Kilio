// Aperçu d'un PDF : rend la 1re page en petite image JPEG, côté navigateur
// (pdf.js). Le rendu côté serveur (fonctions Vercel) serait plus lourd et plus
// fragile. pdf.js n'est chargé qu'à la première demande (import dynamique),
// donc sans coût pour le reste de l'application.
//
// Ne lève jamais : un aperçu est un plus, tout échec (PDF protégé ou
// corrompu, réseau, mémoire) donne `null` et l'appelant garde l'icône PDF.

const LARGEUR_APERCU_PX = 480;
const QUALITE_JPEG = 0.8;
const DELAI_MAX_MS = 20_000;

async function rendrePremierePage(source: Blob | string): Promise<Blob | null> {
  // Build « legacy » : la version courante de pdf.js exige des fonctions JS
  // très récentes (Map.getOrInsertComputed) absentes de nombreux navigateurs
  // mobiles ; testé : elle plante avec « getOrInsertComputed is not a
  // function » là où la legacy rend correctement.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const chargement = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  try {
    const pdf = await chargement.promise;
    const page = await pdf.getPage(1);
    const echelle = LARGEUR_APERCU_PX / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: echelle });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Fond blanc : un PDF est transparent par défaut, le JPEG le rendrait noir.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITE_JPEG));
  } finally {
    await chargement.destroy();
  }
}

/** PDF d'après le type MIME, ou la signature `%PDF-` (type vide sur Android). */
export async function estPdf(fichier: File): Promise<boolean> {
  if (fichier.type === "application/pdf") return true;
  if (fichier.type && fichier.type !== "application/octet-stream") return false;
  return (await fichier.slice(0, 5).text()) === "%PDF-";
}

/** `source` : le fichier choisi, ou l'URL d'un PDF déjà stocké. */
export async function genererApercuPdf(source: Blob | string): Promise<Blob | null> {
  try {
    return await Promise.race([
      rendrePremierePage(source),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DELAI_MAX_MS)),
    ]);
  } catch (err) {
    console.warn("Aperçu du PDF impossible", err);
    return null;
  }
}
