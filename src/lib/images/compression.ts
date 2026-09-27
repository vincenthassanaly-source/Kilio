// Compression et redimensionnement des photos **côté client**, avant tout
// envoi à une Server Action (vague 1 de l'audit, point « uploads ») : les
// Server Actions sont plafonnées à 4 Mo (`bodySizeLimit`, next.config.ts) et
// les fonctions Vercel à 4,5 Mo, alors qu'une photo de téléphone fait 2 à
// 5 Mo. `sharp` recompresse encore côté serveur ; ce module garantit
// seulement que la requête passe.
//
// Un seul utilitaire pour Documents, Collection et le partage natif (Web
// Share Target, voir app/collection/partage/choisir). Sans dépendance :
// `createImageBitmap` (qui applique l'orientation EXIF) + canvas.

/** Plus grand côté conservé : large pour un document à relire (recto/verso). */
const DIMENSION_MAX_PX = 2048;
/** Qualité JPEG : visuellement sans perte à cette taille. */
const QUALITE_JPEG = 0.82;
/** En dessous, l'image part telle quelle (déjà légère). */
const SEUIL_COMPRESSION_OCTETS = 800 * 1024;
/**
 * Budget d'une requête (marge sous `bodySizeLimit: "4mb"` pour l'enveloppe
 * multipart et les autres champs du formulaire).
 */
export const TAILLE_MAX_REQUETE_OCTETS = 3.6 * 1024 * 1024;

export type OptionsCompression = {
  dimensionMax?: number;
  qualite?: number;
  seuil?: number;
};

function estImageCompressible(fichier: File): boolean {
  // GIF (animation) et SVG (vectoriel) ne gagnent rien à passer en JPEG.
  return fichier.type.startsWith("image/") && fichier.type !== "image/gif" && fichier.type !== "image/svg+xml";
}

function nomJpeg(nom: string): string {
  const base = nom.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

async function encoder(bitmap: ImageBitmap, largeur: number, hauteur: number, qualite: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(largeur, hauteur);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    return canvas.convertToBlob({ type: "image/jpeg", quality: qualite });
  }
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualite));
}

/**
 * Redimensionne (plus grand côté ≤ `dimensionMax`) et réencode en JPEG une
 * photo trop lourde. Rend le fichier d'origine s'il n'est pas une image
 * compressible (PDF…), s'il est déjà léger, si le navigateur ne sait pas le
 * décoder (HEIC sur certains navigateurs) ou si le résultat serait plus lourd.
 */
async function compresserImage(fichier: File, options: OptionsCompression = {}): Promise<File> {
  const { dimensionMax = DIMENSION_MAX_PX, qualite = QUALITE_JPEG, seuil = SEUIL_COMPRESSION_OCTETS } = options;
  if (!estImageCompressible(fichier) || fichier.size <= seuil) return fichier;
  if (typeof createImageBitmap === "undefined") return fichier;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  } catch {
    return fichier;
  }

  try {
    const echelle = Math.min(1, dimensionMax / Math.max(bitmap.width, bitmap.height));
    const largeur = Math.max(1, Math.round(bitmap.width * echelle));
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle));
    const blob = await encoder(bitmap, largeur, hauteur, qualite);
    if (!blob || blob.size >= fichier.size) return fichier;
    return new File([blob], nomJpeg(fichier.name), { type: "image/jpeg", lastModified: fichier.lastModified });
  } catch {
    return fichier;
  } finally {
    bitmap.close();
  }
}

/** Compresse une sélection, une image à la fois (mémoire bornée sur mobile). */
export async function compresserImages(fichiers: File[], options?: OptionsCompression): Promise<File[]> {
  const resultat: File[] = [];
  for (const fichier of fichiers) resultat.push(await compresserImage(fichier, options));
  return resultat;
}

/**
 * Répartit des fichiers (déjà compressés) en lots qui tiennent chacun sous
 * `TAILLE_MAX_REQUETE_OCTETS`, pour les envoyer en plusieurs requêtes. Un
 * fichier seul plus gros que le budget forme son propre lot : c'est à
 * l'appelant de le signaler (voir `fichiersTropLourds`).
 */
export function repartirEnLots(fichiers: File[], budget = TAILLE_MAX_REQUETE_OCTETS): File[][] {
  const lots: File[][] = [];
  let courant: File[] = [];
  let taille = 0;
  for (const fichier of fichiers) {
    if (courant.length > 0 && taille + fichier.size > budget) {
      lots.push(courant);
      courant = [];
      taille = 0;
    }
    courant.push(fichier);
    taille += fichier.size;
  }
  if (courant.length > 0) lots.push(courant);
  return lots;
}

export function fichiersTropLourds(fichiers: File[], budget = TAILLE_MAX_REQUETE_OCTETS): File[] {
  return fichiers.filter((f) => f.size > budget);
}

export function formatTaille(octets: number): string {
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/**
 * Remplace, dans un FormData prêt à partir vers une Server Action, les
 * photos des champs `champs` par leur version compressée, et renvoie la
 * taille totale des fichiers qui partiront (pour refuser proprement avant
 * l'envoi plutôt que de se heurter au 413).
 */
export async function compresserFormData(formData: FormData, champs: string[]): Promise<number> {
  let total = 0;
  for (const champ of champs) {
    const valeurs = formData.getAll(champ);
    if (!valeurs.some((v) => v instanceof File)) continue;
    formData.delete(champ);
    for (const valeur of valeurs) {
      if (valeur instanceof File && valeur.size > 0) {
        const compresse = await compresserImage(valeur);
        total += compresse.size;
        formData.append(champ, compresse);
      } else {
        formData.append(champ, valeur);
      }
    }
  }
  return total;
}
