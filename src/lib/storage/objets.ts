// Code serveur commun aux modules Documents et Collection pour les fichiers
// stockés dans Supabase Storage (lot 4 de l'audit : factorisation sans
// changement de comportement). Le bucket est toujours un paramètre.

import sharp from "sharp";
import type { createAdminClient } from "@/lib/supabase/admin";

type ClientStorage = Pick<ReturnType<typeof createAdminClient>, "storage">;

/** Plus grand côté conservé après compression serveur. */
export const IMAGE_MAX_DIMENSION = 1600;
/** Qualité JPEG de la compression serveur. */
export const IMAGE_JPEG_QUALITY = 75;

/**
 * Extrait le chemin d'objet d'une URL publique de bucket
 * (`…/storage/v1/object/public/<bucket>/<chemin>`). Renvoie `null` si l'URL
 * ne contient pas `/<bucket>/`.
 */
export function extraireCheminStorage(url: string, bucket: string): string | null {
  const marqueur = `/${bucket}/`;
  const index = url.indexOf(marqueur);
  if (index === -1) return null;
  return url.slice(index + marqueur.length);
}

/**
 * Corrige l'orientation, réduit (1600 px max, sans agrandir) et recompresse
 * en JPEG (qualité 75), puis envoie sous `<uuid>.jpg` dans le bucket. Renvoie
 * l'URL publique ; lève une Error portant le message de Storage si l'envoi
 * échoue.
 */
export async function compresserEtUploaderImage(
  supabase: ClientStorage,
  bucket: string,
  buffer: Buffer
): Promise<string> {
  const compresse = await sharp(buffer)
    .rotate()
    .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: IMAGE_JPEG_QUALITY })
    .toBuffer();

  const chemin = `${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(chemin, compresse, { contentType: "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(chemin);

  return publicUrl;
}

/**
 * Retire un lot d'objets d'un bucket. Ne fait rien si la liste est vide.
 * Renvoie l'erreur de Storage (ou `null`) : l'appelant choisit de la lever ou
 * de la journaliser, selon que l'échec doit bloquer ou non.
 */
export async function retirerObjetsStorage(
  supabase: ClientStorage,
  bucket: string,
  chemins: string[]
): Promise<{ message: string } | null> {
  if (chemins.length === 0) return null;
  const { error } = await supabase.storage.from(bucket).remove(chemins);
  return error ?? null;
}
