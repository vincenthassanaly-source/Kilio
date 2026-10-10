"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { estMiniatureStockee, estUrlMiniatureTiktokCopiable } from "@/lib/collection/miniature";
import { recupererMetadonneesTiktok } from "@/lib/collection/tiktok";
import { estTypeVideo, recupererMetadonneesVideo } from "@/lib/collection/video";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { Tables, TablesInsert } from "@/lib/supabase/types";

const COLLECTION_IMAGES_BUCKET = "collection-images";
const COLLECTION_IMAGE_MAX_DIMENSION = 1600;
const COLLECTION_IMAGE_JPEG_QUALITY = 75;
// Miniature vidéo copiée dans le bucket : la tuile fait ~200 px de large.
const MINIATURE_MAX_DIMENSION = 640;
const MINIATURE_MAX_OCTETS = 5 * 1024 * 1024;
const MINIATURE_DELAI_MS = 5000;

// Nombre de vignettes affichées dans la mosaïque de couverture d'une
// collection (grille façon Pinterest sur /collection).
const APERCU_PHOTOS_LIMIT = 4;

function revalidateCollectionsPaths(collectionId?: string) {
  revalidatePath("/collection");
  if (collectionId) revalidatePath(`/collection/${collectionId}`);
}

type SupabaseClient = ReturnType<typeof createAdminClient>;

// Compresse et upload chaque fichier (même pattern que uploadTacheImages
// dans src/app/actions/taches.ts). Le chemin de stockage n'est pas préfixé
// par un id de collection : réutilisé tel quel par la réception de partage
// (route.ts), où la collection de destination n'est pas encore connue.
async function compresserEtUploaderPhoto(supabase: SupabaseClient, fichier: File): Promise<string> {
  const buffer = Buffer.from(await fichier.arrayBuffer());
  const compresse = await sharp(buffer)
    .rotate()
    .resize(COLLECTION_IMAGE_MAX_DIMENSION, COLLECTION_IMAGE_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: COLLECTION_IMAGE_JPEG_QUALITY })
    .toBuffer();

  const chemin = `${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(COLLECTION_IMAGES_BUCKET)
    .upload(chemin, compresse, { contentType: "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(COLLECTION_IMAGES_BUCKET).getPublicUrl(chemin);

  return publicUrl;
}

// Chemin de stockage attendu : `${uuid}.jpg`, sous
// `/storage/v1/object/public/collection-images/`. Même logique que
// extraireCheminStorage dans src/app/actions/taches.ts.
function extraireCheminStorage(url: string): string | null {
  const marqueur = `/${COLLECTION_IMAGES_BUCKET}/`;
  const index = url.indexOf(marqueur);
  if (index === -1) return null;
  return url.slice(index + marqueur.length);
}

// Copie une miniature TikTok dans le bucket (les URLs du CDN TikTok sont
// signées et expirent après quelques jours). Ne lève jamais : retourne `null`
// si l'URL n'est pas un CDN TikTok connu, si le téléchargement échoue ou si
// l'image est invalide, pour que l'appelant garde l'URL d'origine.
async function copierMiniatureTiktok(supabase: SupabaseClient, urlSource: string): Promise<string | null> {
  if (!estUrlMiniatureTiktokCopiable(urlSource)) return null;
  try {
    const response = await fetch(urlSource, {
      redirect: "error",
      signal: AbortSignal.timeout(MINIATURE_DELAI_MS),
    });
    if (!response.ok) return null;
    const declaree = Number(response.headers.get("content-length") ?? 0);
    if (declaree > MINIATURE_MAX_OCTETS) return null;

    const source = Buffer.from(await response.arrayBuffer());
    if (source.length > MINIATURE_MAX_OCTETS) return null;

    const compresse = await sharp(source)
      .rotate()
      .resize(MINIATURE_MAX_DIMENSION, MINIATURE_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: COLLECTION_IMAGE_JPEG_QUALITY })
      .toBuffer();

    const chemin = `miniatures/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(COLLECTION_IMAGES_BUCKET)
      .upload(chemin, compresse, { contentType: "image/jpeg" });
    if (error) return null;

    return supabase.storage.from(COLLECTION_IMAGES_BUCKET).getPublicUrl(chemin).data.publicUrl;
  } catch {
    return null;
  }
}

// Miniature à enregistrer pour une vidéo : copie stable pour TikTok, URL
// d'origine pour YouTube (i.ytimg.com n'expire pas) ou si la copie échoue.
async function miniatureAEnregistrer(
  supabase: SupabaseClient,
  type: string,
  miniature: string | null
): Promise<string | null> {
  if (!miniature || type !== "tiktok" || estMiniatureStockee(miniature)) return miniature;
  return (await copierMiniatureTiktok(supabase, miniature)) ?? miniature;
}

async function supprimerMiniatureStockee(supabase: SupabaseClient, miniature: string | null | undefined) {
  const chemin = miniature && estMiniatureStockee(miniature) ? extraireCheminStorage(miniature) : null;
  if (chemin) await supabase.storage.from(COLLECTION_IMAGES_BUCKET).remove([chemin]);
}

// --- Collections ---

export type ApercuItem = { url: string; type: string };

export type CollectionAvecApercu = Tables<"collections"> & {
  photos_apercu: ApercuItem[];
  nb_photos: number;
};

export async function getCollectionsAvecApercu(): Promise<CollectionAvecApercu[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_items(url, thumbnail_url, type, ordre)")
    .order("ordre", { ascending: true })
    .order("created_at", { ascending: false })
    .order("ordre", { referencedTable: "collection_items", ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(({ collection_items, ...collection }) => ({
    ...collection,
    photos_apercu: collection_items.slice(0, APERCU_PHOTOS_LIMIT).map((item) => ({
      url: item.thumbnail_url ?? item.url,
      type: item.type,
    })),
    nb_photos: collection_items.length,
  }));
}

export type CollectionAvecPhotos = Tables<"collections"> & {
  photos: Tables<"collection_items">[];
};

export async function getCollectionAvecPhotos(id: string): Promise<CollectionAvecPhotos | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_items(*)")
    .eq("id", id)
    .order("ordre", { referencedTable: "collection_items", ascending: true })
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { collection_items, ...collection } = data;
  return { ...collection, photos: collection_items };
}

async function creerCollection(supabase: SupabaseClient, nom: string): Promise<string> {
  const { data: derniere } = await supabase
    .from("collections")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("collections")
    .insert({ nom, ordre: (derniere?.ordre ?? -1) + 1 })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export type CollectionFormState = { error: string | null };

export async function createCollection(
  _prevState: CollectionFormState,
  formData: FormData
): Promise<CollectionFormState> {
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { error: "Le nom est requis." };

  const supabase = createAdminClient();

  try {
    await creerCollection(supabase, nom);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de la création." };
  }

  revalidateCollectionsPaths();
  return { error: null };
}

export async function renameCollection(id: string, nom: string) {
  const trimmed = nom.trim();
  if (!trimmed) throw new Error("Le nom est requis.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("collections").update({ nom: trimmed }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidateCollectionsPaths(id);
}

export async function deleteCollection(id: string) {
  const supabase = createAdminClient();

  const { data: photos, error: fetchError } = await supabase
    .from("collection_items")
    .select("url, thumbnail_url")
    .eq("collection_id", id);
  if (fetchError) throw new Error(fetchError.message);

  const chemins = (photos ?? [])
    .flatMap((p) => [extraireCheminStorage(p.url), estMiniatureStockee(p.thumbnail_url) ? extraireCheminStorage(p.thumbnail_url!) : null])
    .filter((c): c is string => c !== null);
  if (chemins.length > 0) {
    const { error: removeError } = await supabase.storage.from(COLLECTION_IMAGES_BUCKET).remove(chemins);
    if (removeError) throw new Error(removeError.message);
  }

  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateCollectionsPaths();
}

// --- Photos (depuis la vue d'une collection) ---

export async function uploadCollectionPhotos(collectionId: string, formData: FormData) {
  const fichiers = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.length === 0) return;

  const supabase = createAdminClient();

  const { data: derniere } = await supabase
    .from("collection_items")
    .select("ordre")
    .eq("collection_id", collectionId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ordreDepart = (derniere?.ordre ?? -1) + 1;

  const urls = await Promise.all(fichiers.map((fichier) => compresserEtUploaderPhoto(supabase, fichier)));

  const { error: insertError } = await supabase.from("collection_items").insert(
    urls.map((url, index) => ({ collection_id: collectionId, url, ordre: ordreDepart + index }))
  );
  if (insertError) throw new Error(insertError.message);

  revalidateCollectionsPaths(collectionId);
}

// Ajoute un lien vidéo (TikTok ou YouTube, détecté depuis l'URL) à une
// collection : récupère ses métadonnées (miniature, titre) via oEmbed puis
// insère un collection_items du type correspondant ('tiktok' / 'youtube'). Suit le même pattern (throw + gestion d'erreur côté composant)
// que uploadCollectionPhotos, plutôt qu'un useActionState : c'est le champ
// d'ajout inline le plus proche dans AddPhotoButton.
export async function ajouterLienVideo(collectionId: string, url: string) {
  const lien = url.trim();
  if (!lien) throw new Error("Le lien est requis.");

  const metadonnees = await recupererMetadonneesVideo(lien);
  if (!metadonnees) throw new Error("Lien TikTok ou YouTube invalide ou introuvable.");

  const supabase = createAdminClient();

  const { data: derniere } = await supabase
    .from("collection_items")
    .select("ordre")
    .eq("collection_id", collectionId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const miniature = await miniatureAEnregistrer(supabase, metadonnees.type, metadonnees.thumbnailUrl);

  const { error } = await supabase.from("collection_items").insert({
    collection_id: collectionId,
    type: metadonnees.type,
    url: metadonnees.url,
    thumbnail_url: miniature,
    titre: metadonnees.titre || null,
    ordre: (derniere?.ordre ?? -1) + 1,
  });
  if (error) {
    await supprimerMiniatureStockee(supabase, miniature);
    throw new Error(error.message);
  }

  revalidateCollectionsPaths(collectionId);
}

export async function deleteCollectionItem(itemId: string) {
  const supabase = createAdminClient();

  const { data: item, error: fetchError } = await supabase
    .from("collection_items")
    .select("url, thumbnail_url, collection_id")
    .eq("id", itemId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const chemins = [
    extraireCheminStorage(item.url),
    estMiniatureStockee(item.thumbnail_url) ? extraireCheminStorage(item.thumbnail_url!) : null,
  ].filter((c): c is string => c !== null);
  if (chemins.length > 0) {
    const { error: removeError } = await supabase.storage.from(COLLECTION_IMAGES_BUCKET).remove(chemins);
    if (removeError) throw new Error(removeError.message);
  }

  const { error } = await supabase.from("collection_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);

  revalidateCollectionsPaths(item.collection_id);
}

// Auto-réparation d'une miniature TikTok expirée : appelée par la grille quand
// l'image d'une tuile ne charge plus. Redemande une miniature fraîche à l'oEmbed
// TikTok, la copie dans le bucket, met la ligne à jour et renvoie la nouvelle
// URL. Pas de revalidatePath : le client met son cache à jour lui-même.
export async function rafraichirMiniatureVideo(itemId: string): Promise<ActionResult<string>> {
  const supabase = createAdminClient();

  const { data: item, error: fetchError } = await supabase
    .from("collection_items")
    .select("url, type, thumbnail_url")
    .eq("id", itemId)
    .single();
  if (fetchError || !item) return fail("Vidéo introuvable.");
  if (item.type !== "tiktok") return fail("Cette vidéo n'a pas de miniature à rafraîchir.");

  const metadonnees = await recupererMetadonneesTiktok(item.url);
  if (!metadonnees) return fail("Miniature indisponible pour le moment.");

  const copie = await copierMiniatureTiktok(supabase, metadonnees.thumbnailUrl);
  if (!copie) return fail("Miniature indisponible pour le moment.");

  const { error } = await supabase.from("collection_items").update({ thumbnail_url: copie }).eq("id", itemId);
  if (error) {
    await supprimerMiniatureStockee(supabase, copie);
    return fail("Miniature indisponible pour le moment.");
  }

  await supprimerMiniatureStockee(supabase, item.thumbnail_url);
  return ok(copie);
}

// --- Web Share Target ---

// Reçoit les fichiers déjà uploadés (sans collection) depuis
// src/app/collection/partage/route.ts, compresse et stocke chaque photo
// dans le bucket, sans les rattacher à une collection.
export async function uploaderPhotosPartagees(fichiers: File[]): Promise<string[]> {
  const supabase = createAdminClient();
  return Promise.all(fichiers.map((fichier) => compresserEtUploaderPhoto(supabase, fichier)));
}

// Variante appelée depuis le navigateur (flux de partage via le service
// worker, app/collection/partage/choisir/PhotosPartageesEnAttente.tsx) :
// les photos arrivent déjà compressées côté client, par lots. Contrat
// `ActionResult` (T1).
export async function televerserPhotosPartagees(formData: FormData): Promise<ActionResult<string[]>> {
  const fichiers = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.length === 0) return ok([]);
  try {
    return ok(await uploaderPhotosPartagees(fichiers));
  } catch {
    return fail("Les photos partagées n'ont pas pu être envoyées. Réessaie.");
  }
}

// Équivalent de uploaderPhotosPartagees pour un lien vidéo (TikTok ou
// YouTube) partagé : récupère
// ses métadonnées immédiatement (sans les rattacher à une collection), pour
// que route.ts les propage en query params vers /collection/partage/choisir.
export async function recupererLienVideoPartage(url: string) {
  return recupererMetadonneesVideo(url);
}

export type RattacherPhotoFormState = { error: string | null };

// Rattache une ou plusieurs photos et/ou un lien vidéo déjà résolus
// (partage natif) à une collection existante ou à une nouvelle collection
// créée à la volée, puis redirige vers la vue de la collection. Signature
// (prevState, formData) pour être pilotée par useActionState, comme le reste
// du repo (cf. createCollection/createNote) : redirect() est appelé après la
// mutation et n'a donc jamais besoin de renvoyer un état de succès.
export async function rattacherPhotoACollection(
  _prevState: RattacherPhotoFormState,
  formData: FormData
): Promise<RattacherPhotoFormState> {
  const collectionIdChoisie = String(formData.get("collection_id") ?? "").trim();
  const nouvelleCollectionNom = String(formData.get("nouvelle_collection") ?? "").trim();
  const urls = formData.getAll("url").map(String).filter(Boolean);
  const videoUrl = String(formData.get("video_url") ?? "").trim();
  const videoThumbnail = String(formData.get("video_thumbnail") ?? "").trim();
  const videoTitre = String(formData.get("video_titre") ?? "").trim();
  const videoType = String(formData.get("video_type") ?? "").trim();

  if (urls.length === 0 && !videoUrl) return { error: "Rien à rattacher." };
  if (videoUrl && !estTypeVideo(videoType)) return { error: "Type de vidéo inconnu." };
  if (!collectionIdChoisie && !nouvelleCollectionNom) {
    return { error: "Choisis une collection ou crée-en une nouvelle." };
  }

  const supabase = createAdminClient();
  let collectionId: string;

  try {
    collectionId = collectionIdChoisie || (await creerCollection(supabase, nouvelleCollectionNom));

    const { data: derniere } = await supabase
      .from("collection_items")
      .select("ordre")
      .eq("collection_id", collectionId)
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ordre = (derniere?.ordre ?? -1) + 1;

    const items: TablesInsert<"collection_items">[] = urls.map((url) => ({
      collection_id: collectionId,
      url,
      ordre: ordre++,
    }));

    if (videoUrl) {
      items.push({
        collection_id: collectionId,
        type: videoType,
        url: videoUrl,
        thumbnail_url: await miniatureAEnregistrer(supabase, videoType, videoThumbnail || null),
        titre: videoTitre || null,
        ordre: ordre++,
      });
    }

    const { error } = await supabase.from("collection_items").insert(items);
    if (error) throw new Error(error.message);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de l'ajout." };
  }

  revalidateCollectionsPaths(collectionId);
  redirect(`/collection/${collectionId}`);
}

export async function getCollections(): Promise<Tables<"collections">[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("ordre", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
