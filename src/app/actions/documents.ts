"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { detecterFormat } from "@/lib/documents/detecterFormat";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

export type DocumentFormState = { error: string | null };

const DOCUMENTS_FICHIERS_BUCKET = "documents-fichiers";
const DOCUMENT_IMAGE_MAX_DIMENSION = 1600;
const DOCUMENT_IMAGE_JPEG_QUALITY = 75;

const CATEGORIES = ["Identité", "Véhicule", "Logement", "Santé", "Assurance", "Autre"] as const;
type DocumentCategorie = (typeof CATEGORIES)[number];

function revalidateDocumentsPaths(id?: string) {
  revalidatePath("/documents");
  if (id) revalidatePath(`/documents/${id}`);
}

type SupabaseClient = ReturnType<typeof createAdminClient>;

// Chemin de stockage attendu : `${uuid}.jpg` ou `${uuid}.pdf`, sous
// `/storage/v1/object/public/documents-fichiers/`. Même logique que
// extraireCheminStorage dans src/app/actions/collections.ts.
function extraireCheminStorage(url: string): string | null {
  const marqueur = `/${DOCUMENTS_FICHIERS_BUCKET}/`;
  const index = url.indexOf(marqueur);
  if (index === -1) return null;
  return url.slice(index + marqueur.length);
}

type FichierUploade = { url: string; fichier_type: "image" | "pdf"; apercu_url: string | null };

const DOCUMENT_APERCU_MAX_DIMENSION = 640;

// Enregistre l'image d'aperçu (1re page d'un PDF, générée côté client) dans
// le bucket. Un aperçu est un plus : s'il est illisible ou si l'envoi échoue,
// on renvoie null et le PDF reste ajouté avec son icône, sans faire échouer
// toute l'opération.
async function uploaderApercu(supabase: SupabaseClient, apercu: File | null): Promise<string | null> {
  if (!apercu || apercu.size === 0) return null;
  try {
    const jpeg = await sharp(Buffer.from(await apercu.arrayBuffer()))
      .resize(DOCUMENT_APERCU_MAX_DIMENSION, DOCUMENT_APERCU_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: DOCUMENT_IMAGE_JPEG_QUALITY })
      .toBuffer();
    const chemin = `${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(DOCUMENTS_FICHIERS_BUCKET)
      .upload(chemin, jpeg, { contentType: "image/jpeg" });
    if (error) return null;
    return supabase.storage.from(DOCUMENTS_FICHIERS_BUCKET).getPublicUrl(chemin).data.publicUrl;
  } catch {
    return null;
  }
}

function fichierOuNull(valeur: FormDataEntryValue | null): File | null {
  return valeur instanceof File && valeur.size > 0 ? valeur : null;
}

// Compresse les images (même pattern que compresserEtUploaderPhoto dans
// collections.ts) ; les PDF sont uploadés tels quels, sharp ne les
// supportant pas. Le format est reconnu d'après le contenu si le type MIME
// est vide (voir detecterFormat). `apercu` : image de la 1re page d'un PDF.
async function uploaderFichier(
  supabase: SupabaseClient,
  fichier: File,
  apercu: File | null = null
): Promise<FichierUploade> {
  const buffer = Buffer.from(await fichier.arrayBuffer());
  const format = detecterFormat(fichier, buffer);

  if (format === "image") {
    const compresse = await sharp(buffer)
      .rotate()
      .resize(DOCUMENT_IMAGE_MAX_DIMENSION, DOCUMENT_IMAGE_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: DOCUMENT_IMAGE_JPEG_QUALITY })
      .toBuffer();

    const chemin = `${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_FICHIERS_BUCKET)
      .upload(chemin, compresse, { contentType: "image/jpeg" });
    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from(DOCUMENTS_FICHIERS_BUCKET).getPublicUrl(chemin);

    return { url: publicUrl, fichier_type: "image", apercu_url: null };
  }

  if (format !== "pdf") {
    throw new Error("Format de fichier non supporté (image ou PDF uniquement).");
  }

  const chemin = `${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_FICHIERS_BUCKET)
    .upload(chemin, buffer, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(DOCUMENTS_FICHIERS_BUCKET).getPublicUrl(chemin);

  return { url: publicUrl, fichier_type: "pdf", apercu_url: await uploaderApercu(supabase, apercu) };
}

// Upload un ou plusieurs fichiers et insère une ligne document_fichiers par
// fichier — même pattern que uploadTacheImages dans
// src/app/actions/taches.ts. Deux sources possibles dans le formData :
// - "fichiers" (multiple) : sélecteur générique (étiquette type_champs
//   "standard" ou "periode_mensuelle").
// - "fichier_recto" / "fichier_verso" (un seul fichier chacun) : emplacements
//   dédiés pour une étiquette de type "recto_verso", marqués via la colonne
//   `role` pour que l'affichage puisse les distinguer.
// Ne fait rien si aucun fichier n'est fourni (cas normal en édition, la
// plupart des soumissions n'ajoutent pas de fichier).
async function uploadDocumentFichiers(documentId: string, formData: FormData) {
  const fichiers = formData.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);

  const rectoVerso: { role: "recto" | "verso"; fichier: File }[] = [];
  const rectoFichier = formData.get("fichier_recto");
  if (rectoFichier instanceof File && rectoFichier.size > 0) {
    rectoVerso.push({ role: "recto", fichier: rectoFichier });
  }
  const versoFichier = formData.get("fichier_verso");
  if (versoFichier instanceof File && versoFichier.size > 0) {
    rectoVerso.push({ role: "verso", fichier: versoFichier });
  }

  if (fichiers.length === 0 && rectoVerso.length === 0) return;

  const supabase = createAdminClient();

  const { data: derniere } = await supabase
    .from("document_fichiers")
    .select("ordre")
    .eq("document_id", documentId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ordreDepart = (derniere?.ordre ?? -1) + 1;

  // Aperçus des PDF, générés côté client (voir DocumentForm) : un champ
  // `apercu:<champ>` par fichier recto/verso, `apercu:fichiers:<n>` pour le
  // n-ième fichier (hors fichiers vides) du sélecteur générique.
  if (rectoVerso.length > 0) {
    const uploades = await Promise.all(
      rectoVerso.map(({ role, fichier }) =>
        uploaderFichier(supabase, fichier, fichierOuNull(formData.get(`apercu:fichier_${role}`)))
      )
    );

    const { error: insertError } = await supabase.from("document_fichiers").insert(
      uploades.map((uploade, index) => ({
        document_id: documentId,
        url: uploade.url,
        fichier_type: uploade.fichier_type,
        apercu_url: uploade.apercu_url,
        ordre: ordreDepart + index,
        role: rectoVerso[index].role,
      }))
    );
    if (insertError) throw new Error(insertError.message);
  }

  const ordreFichiersDepart = ordreDepart + rectoVerso.length;

  if (fichiers.length > 0) {
    const uploades = await Promise.all(
      fichiers.map((fichier, index) =>
        uploaderFichier(supabase, fichier, fichierOuNull(formData.get(`apercu:fichiers:${index}`)))
      )
    );

    const { error: insertError } = await supabase.from("document_fichiers").insert(
      uploades.map((uploade, index) => ({
        document_id: documentId,
        url: uploade.url,
        fichier_type: uploade.fichier_type,
        apercu_url: uploade.apercu_url,
        ordre: ordreFichiersDepart + index,
      }))
    );
    if (insertError) throw new Error(insertError.message);
  }

  revalidateDocumentsPaths(documentId);
}

export async function deleteDocumentFichier(fichierId: string) {
  const supabase = createAdminClient();

  const { data: fichier, error: fetchError } = await supabase
    .from("document_fichiers")
    .select("url, apercu_url, document_id")
    .eq("id", fichierId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const chemins = [fichier.url, fichier.apercu_url]
    .map((u) => (u ? extraireCheminStorage(u) : null))
    .filter((c): c is string => c !== null);
  if (chemins.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(DOCUMENTS_FICHIERS_BUCKET)
      .remove(chemins);
    if (removeError) throw new Error(removeError.message);
  }

  const { error } = await supabase.from("document_fichiers").delete().eq("id", fichierId);
  if (error) throw new Error(error.message);

  revalidateDocumentsPaths(fichier.document_id);
}

// Rattrapage : enregistre l'aperçu d'un PDF déjà stocké (ajouté avant la
// colonne `apercu_url`, ou dont le rendu avait échoué). Appelée depuis la
// liste, qui génère l'image côté client. Ne remplace jamais un aperçu
// existant (deux onglets ouverts : le second ne fait rien).
export async function enregistrerApercuPdf(fichierId: string, formData: FormData): Promise<ActionResult> {
  const apercu = fichierOuNull(formData.get("apercu"));
  if (!apercu) return fail("Aperçu manquant.");

  const supabase = createAdminClient();
  const { data: fichier, error: fetchError } = await supabase
    .from("document_fichiers")
    .select("fichier_type, apercu_url, document_id")
    .eq("id", fichierId)
    .maybeSingle();
  if (fetchError) return fail(fetchError.message);
  if (!fichier || fichier.fichier_type !== "pdf" || fichier.apercu_url) return ok();

  const apercuUrl = await uploaderApercu(supabase, apercu);
  if (!apercuUrl) return fail("Impossible d'enregistrer l'aperçu.");

  const { error } = await supabase
    .from("document_fichiers")
    .update({ apercu_url: apercuUrl })
    .eq("id", fichierId)
    .is("apercu_url", null);
  if (error) return fail(error.message);

  revalidateDocumentsPaths(fichier.document_id);
  return ok();
}

// --- Étiquettes ---
// Liste gérable à affectation exclusive — un document a au plus une
// étiquette, comme listes_taches pour les tâches. Complète la catégorie
// large existante par un type précis (ex. "Permis de conduire"), choisi à
// la création du document.

export type EtiquetteFormState = { error: string | null };

// Détermine les champs supplémentaires affichés dans DocumentForm quand
// cette étiquette est sélectionnée (cf. le pattern déjà utilisé par
// objectifs.type_suivi pour changer les champs de suivi affichés) :
// - "standard" : aucun champ en plus (comportement d'origine).
// - "recto_verso" : deux emplacements de fichier dédiés (Recto/Verso) au
//   lieu du sélecteur générique multi-fichiers.
// - "periode_mensuelle" : un champ "mois concerné" en plus (documents.
//   periode_mois).
const TYPES_CHAMPS = ["standard", "recto_verso", "periode_mensuelle"] as const;
export type TypeChampsEtiquette = (typeof TYPES_CHAMPS)[number];

function revalidateEtiquettesPaths() {
  revalidatePath("/documents");
  revalidatePath("/documents/etiquettes");
}

export async function getEtiquettes(): Promise<Tables<"etiquettes">[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("etiquettes").select("*").order("nom", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

function parseTypeChamps(formData: FormData): TypeChampsEtiquette | null {
  const value = String(formData.get("type_champs") ?? "standard");
  return TYPES_CHAMPS.includes(value as TypeChampsEtiquette) ? (value as TypeChampsEtiquette) : null;
}

export async function createEtiquette(
  _prevState: EtiquetteFormState,
  formData: FormData
): Promise<EtiquetteFormState> {
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { error: "Le nom est requis." };

  const typeChamps = parseTypeChamps(formData);
  if (!typeChamps) return { error: "Type de champs invalide." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("etiquettes").insert({ nom, type_champs: typeChamps });

  if (error) return { error: error.message };

  revalidateEtiquettesPaths();
  return { error: null };
}

export async function updateEtiquette(id: string, nom: string, typeChamps: TypeChampsEtiquette) {
  const trimmed = nom.trim();
  if (!trimmed) throw new Error("Le nom est requis.");
  if (!TYPES_CHAMPS.includes(typeChamps)) throw new Error("Type de champs invalide.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("etiquettes")
    .update({ nom: trimmed, type_champs: typeChamps })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidateEtiquettesPaths();
}

// Les documents portant cette étiquette la perdent (`on delete set null`)
// sans être supprimés.
export async function deleteEtiquette(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("etiquettes").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidateEtiquettesPaths();
}

type DocumentInput = {
  nom: string;
  categorie: DocumentCategorie | null;
  etiquette_id: string | null;
  date_echeance: string | null;
  periode_mois: string | null;
  notes: string | null;
};

type ParseResult = { ok: true; value: DocumentInput } | { ok: false; error: string };

function parseDocumentInput(formData: FormData): ParseResult {
  const nom = String(formData.get("nom") ?? "").trim();
  const categorie = String(formData.get("categorie") ?? "").trim();
  const etiquette_id = String(formData.get("etiquette_id") ?? "").trim();
  const date_echeance = String(formData.get("date_echeance") ?? "").trim();
  // Un <input type="month"> soumet "AAAA-MM" : stocké comme le 1er jour du
  // mois (documents.periode_mois est une colonne date).
  const periode_mois_brute = String(formData.get("periode_mois") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!nom) return { ok: false, error: "Le nom est requis." };
  if (categorie && !CATEGORIES.includes(categorie as DocumentCategorie)) {
    return { ok: false, error: "Catégorie invalide." };
  }

  return {
    ok: true,
    value: {
      nom,
      categorie: categorie ? (categorie as DocumentCategorie) : null,
      etiquette_id: etiquette_id || null,
      date_echeance: date_echeance || null,
      periode_mois: periode_mois_brute ? `${periode_mois_brute}-01` : null,
      notes: notes || null,
    },
  };
}

export async function createDocument(
  _prevState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const parsed = parseDocumentInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const fichiers = formData.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  const rectoOuVerso = [formData.get("fichier_recto"), formData.get("fichier_verso")].some(
    (f) => f instanceof File && f.size > 0
  );
  if (fichiers.length === 0 && !rectoOuVerso) {
    return { error: "Au moins un fichier (photo ou PDF) est requis." };
  }

  const supabase = createAdminClient();
  const { data: document, error } = await supabase
    .from("documents")
    .insert(parsed.value)
    .select("id")
    .single();

  if (error) return { error: error.message };

  try {
    await uploadDocumentFichiers(document.id, formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de l'envoi des fichiers." };
  }

  revalidateDocumentsPaths();
  return { error: null };
}

export async function updateDocument(
  _prevState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Document introuvable." };

  const parsed = parseDocumentInput(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = createAdminClient();

  const { data: existant, error: fetchError } = await supabase
    .from("documents")
    .select("date_echeance")
    .eq("id", id)
    .single();
  if (fetchError) return { error: fetchError.message };

  // Une échéance déplacée invalide une alerte déjà "acquise" pour l'ancien
  // seuil : sans ça, un document repoussé ne renverrait plus jamais
  // d'alerte (même logique que rappelObsolete dans src/app/actions/taches.ts).
  const echeanceChangee = existant.date_echeance !== parsed.value.date_echeance;

  const { error } = await supabase
    .from("documents")
    .update({
      ...parsed.value,
      ...(echeanceChangee ? { derniere_alerte_envoyee_le: null } : {}),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  try {
    await uploadDocumentFichiers(id, formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de l'envoi des fichiers." };
  }

  revalidateDocumentsPaths(id);
  return { error: null };
}

export async function deleteDocument(id: string) {
  const supabase = createAdminClient();

  const { data: fichiers, error: fetchError } = await supabase
    .from("document_fichiers")
    .select("url, apercu_url")
    .eq("document_id", id);
  if (fetchError) throw new Error(fetchError.message);

  const chemins = (fichiers ?? [])
    .flatMap((f) => [f.url, f.apercu_url])
    .map((u) => (u ? extraireCheminStorage(u) : null))
    .filter((c): c is string => c !== null);
  if (chemins.length > 0) {
    const { error: removeError } = await supabase.storage.from(DOCUMENTS_FICHIERS_BUCKET).remove(chemins);
    if (removeError) throw new Error(removeError.message);
  }

  // document_fichiers est supprimé en cascade par la contrainte
  // `on delete cascade` (migration-documents-fichiers-multiples-2026-09-11.sql).
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Même pattern que supprimerObjectif dans src/app/actions/objectifs.ts :
  // redirige vers /documents dans les deux cas d'appel (depuis la liste, où
  // c'est un no-op, et depuis le détail, où ça ramène à la liste).
  revalidateDocumentsPaths();
  redirect("/documents");
}

export type DocumentAvecFichiers = Tables<"documents"> & {
  fichiers: Tables<"document_fichiers">[];
  etiquette: Tables<"etiquettes"> | null;
};

const SELECT_DOCUMENT_AVEC_RELATIONS = "*, document_fichiers(*), etiquette:etiquettes(*)";

function mapDocumentAvecRelations(
  row: Tables<"documents"> & {
    document_fichiers: Tables<"document_fichiers">[];
    etiquette: Tables<"etiquettes"> | null;
  }
): DocumentAvecFichiers {
  const { document_fichiers, etiquette, ...document } = row;
  return {
    ...document,
    fichiers: document_fichiers,
    etiquette,
  };
}

export async function getDocuments(): Promise<DocumentAvecFichiers[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .select(SELECT_DOCUMENT_AVEC_RELATIONS)
    .order("date_echeance", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("ordre", { referencedTable: "document_fichiers", ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapDocumentAvecRelations);
}

export async function getDocument(id: string): Promise<DocumentAvecFichiers | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .select(SELECT_DOCUMENT_AVEC_RELATIONS)
    .eq("id", id)
    .order("ordre", { referencedTable: "document_fichiers", ascending: true })
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapDocumentAvecRelations(data);
}
