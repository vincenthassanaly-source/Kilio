"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";
import { champsManquants, messageManquants, normaliserHashtag } from "@/lib/vinted/kit";
import {
  DESCRIPTION_MAX,
  PHOTOS_MAX,
  TITRE_MAX,
  estStatut,
  type ChampsAnnonce,
  type ReglagesVinted,
  type Statut,
} from "@/lib/vinted/types";

const BUCKET = "vinted-images";
// Vinted recadre en carré à l'affichage mais garde la photo entière à l'ouverture :
// on conserve donc une bonne résolution (plus que Collection, 1600/75).
const PHOTO_MAX_DIMENSION = 1800;
const PHOTO_JPEG_QUALITY = 80;

type SupabaseClient = ReturnType<typeof createAdminClient>;

function revalidateVinted(annonceId?: string) {
  revalidatePath("/vinted");
  if (annonceId) revalidatePath(`/vinted/${annonceId}`);
}

// Chemin attendu : `${annonceId}/${uuid}.jpg` sous `/vinted-images/`
// (même logique qu'extraireCheminStorage dans collections.ts).
function extraireCheminStorage(url: string): string | null {
  const marqueur = `/${BUCKET}/`;
  const index = url.indexOf(marqueur);
  return index === -1 ? null : url.slice(index + marqueur.length);
}

// --- Lecture ---

export type PhotoVinted = Pick<Tables<"vinted_photos">, "id" | "url" | "ordre">;
export type AnnonceVinted = Tables<"vinted_annonces"> & { photos: PhotoVinted[] };

export async function getAnnonces(): Promise<AnnonceVinted[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vinted_annonces")
    .select("*, vinted_photos(id, url, ordre)")
    .order("created_at", { ascending: false })
    .order("ordre", { referencedTable: "vinted_photos", ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map(({ vinted_photos, ...annonce }) => ({ ...annonce, photos: vinted_photos }));
}

export async function getAnnonce(id: string): Promise<AnnonceVinted | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vinted_annonces")
    .select("*, vinted_photos(id, url, ordre)")
    .eq("id", id)
    .order("ordre", { referencedTable: "vinted_photos", ascending: true })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { vinted_photos, ...annonce } = data;
  return { ...annonce, photos: vinted_photos };
}

export async function getReglagesVinted(): Promise<ReglagesVinted> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("vinted_reglages").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);

  const parCategorie =
    data && typeof data.hashtags_par_categorie === "object" && data.hashtags_par_categorie !== null && !Array.isArray(data.hashtags_par_categorie)
      ? (data.hashtags_par_categorie as Record<string, string[]>)
      : {};
  return {
    signature: data?.signature ?? "",
    colis_defaut: data?.colis_defaut ?? "",
    hashtags_communs: data?.hashtags_communs ?? [],
    hashtags_par_categorie: parCategorie,
  };
}

// --- Écriture d'une annonce ---

export async function creerAnnonce(): Promise<ActionResult<{ id: string }>> {
  const supabase = createAdminClient();
  const reglages = await getReglagesVinted().catch(() => null);
  const { data, error } = await supabase
    .from("vinted_annonces")
    .insert({ colis: reglages?.colis_defaut ?? "" })
    .select("id")
    .single();
  if (error) return fail(error.message);

  revalidateVinted();
  return ok({ id: data.id });
}

function nettoyerChamps(champs: ChampsAnnonce): ChampsAnnonce | string {
  const titre = champs.titre.trim();
  if (titre.length > TITRE_MAX) return `Le titre dépasse ${TITRE_MAX} caractères.`;
  const description = champs.description.trim();
  if (description.length > DESCRIPTION_MAX) return `La description dépasse ${DESCRIPTION_MAX} caractères.`;
  if (champs.prix !== null && (!Number.isFinite(champs.prix) || champs.prix < 0 || champs.prix > 99999)) {
    return "Le prix est invalide.";
  }

  const vus = new Set<string>();
  const hashtags: string[] = [];
  for (const brut of champs.hashtags) {
    const tag = normaliserHashtag(brut);
    if (tag && !vus.has(tag)) {
      vus.add(tag);
      hashtags.push(tag);
    }
  }

  return {
    titre,
    description,
    hashtags,
    categorie: champs.categorie.trim(),
    marque: champs.marque.trim(),
    taille: champs.taille.trim(),
    etat: champs.etat.trim(),
    couleur: champs.couleur.trim(),
    matiere: champs.matiere.trim(),
    prix: champs.prix === null ? null : Math.round(champs.prix * 100) / 100,
    colis: champs.colis.trim(),
  };
}

export async function modifierAnnonce(id: string, champs: ChampsAnnonce): Promise<ActionResult> {
  const propres = nettoyerChamps(champs);
  if (typeof propres === "string") return fail(propres);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("vinted_annonces")
    .update({ ...propres, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidateVinted(id);
  return ok();
}

export async function changerStatutAnnonce(id: string, statut: Statut): Promise<ActionResult> {
  if (!estStatut(statut)) return fail("Statut inconnu.");
  const supabase = createAdminClient();

  // Une annonce ne devient « Prête » que si elle est complète : le kit de
  // publication n'aurait sinon rien d'exploitable à coller dans Vinted.
  if (statut === "pret") {
    const annonce = await getAnnonce(id);
    if (!annonce) return fail("Annonce introuvable.");
    const reglages = await getReglagesVinted();
    const manquants = champsManquants(annonce, annonce.photos.length, reglages);
    if (manquants.length > 0) return fail(messageManquants(manquants));
  }

  const { error } = await supabase
    .from("vinted_annonces")
    .update({ statut, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidateVinted(id);
  return ok();
}

async function supprimerFichiers(supabase: SupabaseClient, urls: string[]) {
  const chemins = urls.map(extraireCheminStorage).filter((c): c is string => c !== null);
  if (chemins.length === 0) return null;
  const { error } = await supabase.storage.from(BUCKET).remove(chemins);
  return error;
}

export async function supprimerAnnonce(id: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: photos, error: lectureErreur } = await supabase.from("vinted_photos").select("url").eq("annonce_id", id);
  if (lectureErreur) return fail(lectureErreur.message);

  const erreurStockage = await supprimerFichiers(
    supabase,
    (photos ?? []).map((p) => p.url)
  );
  if (erreurStockage) return fail(erreurStockage.message);

  const { error } = await supabase.from("vinted_annonces").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidateVinted();
  return ok();
}

// --- Photos ---

export async function ajouterPhotosAnnonce(annonceId: string, formData: FormData): Promise<ActionResult<{ ajoutees: number }>> {
  const fichiers = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.length === 0) return ok({ ajoutees: 0 });

  const supabase = createAdminClient();

  const { data: existantes, error: lectureErreur } = await supabase
    .from("vinted_photos")
    .select("ordre")
    .eq("annonce_id", annonceId)
    .order("ordre", { ascending: false });
  if (lectureErreur) return fail(lectureErreur.message);

  const nbExistantes = existantes?.length ?? 0;
  if (nbExistantes + fichiers.length > PHOTOS_MAX) {
    return fail(`Une annonce Vinted accepte ${PHOTOS_MAX} photos au maximum.`);
  }
  const ordreDepart = (existantes?.[0]?.ordre ?? -1) + 1;

  const urls: string[] = [];
  try {
    for (const fichier of fichiers) {
      const compresse = await sharp(Buffer.from(await fichier.arrayBuffer()))
        .rotate()
        .resize(PHOTO_MAX_DIMENSION, PHOTO_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: PHOTO_JPEG_QUALITY })
        .toBuffer();
      const chemin = `${annonceId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(chemin, compresse, { contentType: "image/jpeg" });
      if (uploadError) throw new Error(uploadError.message);
      urls.push(supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl);
    }
  } catch (err) {
    await supprimerFichiers(supabase, urls);
    return fail(err instanceof Error ? err.message : "L'envoi des photos a échoué.");
  }

  const { error: insertError } = await supabase
    .from("vinted_photos")
    .insert(urls.map((url, index) => ({ annonce_id: annonceId, url, ordre: ordreDepart + index })));
  if (insertError) {
    await supprimerFichiers(supabase, urls);
    return fail(insertError.message);
  }

  revalidateVinted(annonceId);
  return ok({ ajoutees: urls.length });
}

export async function supprimerPhotoAnnonce(photoId: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: photo, error: lectureErreur } = await supabase
    .from("vinted_photos")
    .select("url, annonce_id")
    .eq("id", photoId)
    .single();
  if (lectureErreur) return fail(lectureErreur.message);

  const erreurStockage = await supprimerFichiers(supabase, [photo.url]);
  if (erreurStockage) return fail(erreurStockage.message);

  const { error } = await supabase.from("vinted_photos").delete().eq("id", photoId);
  if (error) return fail(error.message);

  revalidateVinted(photo.annonce_id);
  return ok();
}

/** Enregistre l'ordre des photos : `ids` est la liste complète, dans le nouvel ordre. */
export async function reordonnerPhotosAnnonce(annonceId: string, ids: string[]): Promise<ActionResult> {
  const supabase = createAdminClient();
  for (const [ordre, id] of ids.entries()) {
    const { error } = await supabase.from("vinted_photos").update({ ordre }).eq("id", id).eq("annonce_id", annonceId);
    if (error) return fail(error.message);
  }
  revalidateVinted(annonceId);
  return ok();
}

// --- Réglages ---

export async function enregistrerReglagesVinted(reglages: ReglagesVinted): Promise<ActionResult> {
  const parCategorie: Record<string, string[]> = {};
  for (const [cle, tags] of Object.entries(reglages.hashtags_par_categorie)) {
    const cleNette = cle.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const propres = tags.map(normaliserHashtag).filter((t): t is string => t !== null);
    if (cleNette && propres.length > 0) parCategorie[cleNette] = [...new Set(propres)];
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("vinted_reglages").upsert({
    id: true,
    signature: reglages.signature.trim(),
    colis_defaut: reglages.colis_defaut.trim(),
    hashtags_communs: [...new Set(reglages.hashtags_communs.map(normaliserHashtag).filter((t): t is string => t !== null))],
    hashtags_par_categorie: parCategorie,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail(error.message);

  revalidatePath("/vinted/reglages");
  revalidatePath("/vinted");
  return ok();
}
