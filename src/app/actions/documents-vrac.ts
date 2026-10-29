"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  CATEGORIE_MAX,
  FICHIERS_MAX_ANALYSE,
  NOM_MAX,
  SCHEMA_TRI,
  TAILLE_MAX_ANALYSE_OCTETS,
  construirePromptTri,
  lireReponseTri,
  nettoyerTexte,
  nomDepuisFichier,
  trouverCategorie,
  type PropositionTri,
} from "@/lib/documents/tri";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { createAdminClient } from "@/lib/supabase/admin";

// Vrac : documents reçus par le partage Android (documents.en_vrac = true),
// à trier avec Gemini. Le tri se fait en deux temps, avec un aperçu entre les
// deux : `analyserDocumentVrac` (un document, lecture seule, appelée une fois
// par document pour afficher la progression et isoler les échecs), puis
// `appliquerTriVrac` (écrit seulement les propositions validées).

const BUCKET = "documents-fichiers";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHEMIN_FICHIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|pdf)$/i;
const TELECHARGEMENT_TIMEOUT_MS = 20_000;
const GEMINI_TIMEOUT_MS = 40_000;
const LOT_MAX_APPLIQUE = 50;
const FICHIERS_MAX_PAR_ENVOI = 20;

function revalidateVrac(ids: string[] = []) {
  revalidatePath("/documents");
  for (const id of ids) revalidatePath(`/documents/${id}`);
}

// --- Analyse (lecture seule) ---

export type ResultatAnalyse =
  | { ok: true; proposition: PropositionTri }
  | { ok: false; erreur: string; quota: boolean };

function echecAnalyse(erreur: string, quota = false): ResultatAnalyse {
  return { ok: false, erreur, quota };
}

type EntreeFichier = { url: string; fichier_type: string };

function typeMime(fichier: EntreeFichier, typeReponse: string | null): string {
  if (typeReponse?.startsWith("image/") || typeReponse === "application/pdf") return typeReponse;
  return fichier.fichier_type === "pdf" ? "application/pdf" : "image/jpeg";
}

export async function analyserDocumentVrac(id: string, categoriesSupplementaires: string[] = []): Promise<ResultatAnalyse> {
  if (!UUID.test(id)) return echecAnalyse("Document introuvable.");

  const supabase = createAdminClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("nom, en_vrac, document_fichiers(url, fichier_type, ordre)")
    .eq("id", id)
    .order("ordre", { referencedTable: "document_fichiers", ascending: true })
    .maybeSingle();
  if (error) return echecAnalyse("Le document n'a pas pu être lu. Réessaie.");
  if (!document) return echecAnalyse("Document introuvable.");
  if (!document.en_vrac) return echecAnalyse("Ce document n'est plus en vrac.");

  const fichiers = (document.document_fichiers as EntreeFichier[]).slice(0, FICHIERS_MAX_ANALYSE);
  if (fichiers.length === 0) return echecAnalyse("Ce document n'a aucun fichier à analyser.");

  const { data: lignes, error: categoriesError } = await supabase.from("documents_categories").select("nom");
  if (categoriesError) return echecAnalyse("Les catégories n'ont pas pu être lues. Réessaie.");
  const categories = [...(lignes ?? []).map((c) => c.nom)];
  for (const supplementaire of categoriesSupplementaires.slice(0, 20)) {
    const nom = nettoyerTexte(supplementaire).slice(0, CATEGORIE_MAX);
    if (nom && !trouverCategorie(nom, categories)) categories.push(nom);
  }

  const images: { mimeType: string; data: string }[] = [];
  let total = 0;
  for (const fichier of fichiers) {
    let reponse: Response;
    try {
      reponse = await fetch(fichier.url, { signal: AbortSignal.timeout(TELECHARGEMENT_TIMEOUT_MS) });
    } catch {
      return echecAnalyse("Le fichier n'a pas pu être téléchargé. Réessaie.");
    }
    if (!reponse.ok) return echecAnalyse("Le fichier n'a pas pu être téléchargé. Réessaie.");
    const annonce = Number(reponse.headers.get("content-length"));
    if (annonce > TAILLE_MAX_ANALYSE_OCTETS - total) {
      return echecAnalyse("Trop volumineux pour l'analyse : classe-le à la main.");
    }
    const octets = Buffer.from(await reponse.arrayBuffer());
    total += octets.length;
    if (total > TAILLE_MAX_ANALYSE_OCTETS) return echecAnalyse("Trop volumineux pour l'analyse : classe-le à la main.");
    images.push({ mimeType: typeMime(fichier, reponse.headers.get("content-type")), data: octets.toString("base64") });
  }

  const resultat = await appelerGemini({
    prompt: construirePromptTri(categories, document.nom),
    images,
    schema: SCHEMA_TRI,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.2,
    etiquette: "tri-documents",
  });
  if (!resultat.ok) {
    return resultat.code === "quota"
      ? echecAnalyse(MESSAGE_QUOTA_GEMINI, true)
      : echecAnalyse(`Gemini n'a pas pu lire ce document (${resultat.detail})`);
  }
  return { ok: true, proposition: lireReponseTri(resultat.brut, categories, document.nom) };
}

// --- Application (écriture) ---

export type ElementTriValide = { id: string; nom: string; categorie: string | null };
export type ResultatApplication = { appliques: number; echecs: number };

export async function appliquerTriVrac(elements: ElementTriValide[]): Promise<ActionResult<ResultatApplication>> {
  if (!Array.isArray(elements) || elements.length === 0) return fail("Rien à appliquer.");
  if (elements.length > LOT_MAX_APPLIQUE) return fail("Trop de documents d'un coup.");

  const valides: ElementTriValide[] = [];
  for (const element of elements) {
    const nom = nettoyerTexte(element?.nom).slice(0, NOM_MAX);
    const categorie = nettoyerTexte(element?.categorie).slice(0, CATEGORIE_MAX);
    if (!UUID.test(String(element?.id)) || !nom) return fail("Un des noms est vide.");
    valides.push({ id: element.id, nom, categorie: categorie || null });
  }

  const supabase = createAdminClient();

  // Catégories nouvelles : créées maintenant (et seulement maintenant), une
  // fois l'aperçu validé. Casse et accents ignorés pour ne pas dupliquer.
  const { data: existantes, error: categoriesError } = await supabase.from("documents_categories").select("nom");
  if (categoriesError) return fail("Le tri n'a pas pu être appliqué. Réessaie.");
  const connues = (existantes ?? []).map((c) => c.nom);
  const aCreer: string[] = [];
  for (const { categorie } of valides) {
    if (categorie && !trouverCategorie(categorie, connues) && !trouverCategorie(categorie, aCreer)) aCreer.push(categorie);
  }
  if (aCreer.length > 0) {
    const { error } = await supabase.from("documents_categories").insert(aCreer.map((nom) => ({ nom })));
    if (error) return fail("Les nouvelles catégories n'ont pas pu être créées. Réessaie.");
  }
  const toutes = [...connues, ...aCreer];

  let appliques = 0;
  for (const { id, nom, categorie } of valides) {
    const { data, error } = await supabase
      .from("documents")
      .update({ nom, categorie: categorie ? (trouverCategorie(categorie, toutes) ?? categorie) : null, en_vrac: false })
      .eq("id", id)
      .eq("en_vrac", true)
      .select("id");
    if (!error && (data?.length ?? 0) > 0) appliques += 1;
  }

  revalidateVrac(valides.map((v) => v.id));
  return ok({ appliques, echecs: valides.length - appliques });
}

// --- Arrivée dans le vrac (partage Android, upload direct) ---
// Les fichiers partent du téléphone directement vers le bucket par URL
// signée : ils ne traversent pas la fonction Vercel (plafond de 4,5 Mo). Puis
// `enregistrerDocumentsVrac` crée les documents en vrac.

export type UploadPrepare = { path: string; signedUrl: string; publicUrl: string };

export async function preparerUploadsVrac(types: ("image" | "pdf")[]): Promise<ActionResult<UploadPrepare[]>> {
  if (!Array.isArray(types) || types.length === 0 || types.length > FICHIERS_MAX_PAR_ENVOI) {
    return fail(`Entre 1 et ${FICHIERS_MAX_PAR_ENVOI} fichiers à la fois.`);
  }
  if (types.some((t) => t !== "image" && t !== "pdf")) return fail("Format de fichier non supporté (image ou PDF uniquement).");

  const supabase = createAdminClient();
  const uploads: UploadPrepare[] = [];
  for (const type of types) {
    const path = `${crypto.randomUUID()}.${type === "pdf" ? "pdf" : "jpg"}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return fail("L'envoi n'a pas pu être préparé. Réessaie.");
    uploads.push({
      path,
      signedUrl: data.signedUrl,
      publicUrl: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    });
  }
  return ok(uploads);
}

export type FichierVracEnvoye = { path: string; nomOriginal: string };

export async function enregistrerDocumentsVrac(fichiers: FichierVracEnvoye[]): Promise<ActionResult<{ crees: number }>> {
  if (!Array.isArray(fichiers) || fichiers.length === 0 || fichiers.length > FICHIERS_MAX_PAR_ENVOI) {
    return fail(`Entre 1 et ${FICHIERS_MAX_PAR_ENVOI} fichiers à la fois.`);
  }
  if (fichiers.some((f) => !CHEMIN_FICHIER.test(String(f?.path)))) return fail("Fichier invalide.");

  const supabase = createAdminClient();
  for (const { path } of fichiers) {
    const { data: present } = await supabase.storage.from(BUCKET).exists(path);
    if (!present) return fail("Un fichier n'a pas été envoyé correctement. Réessaie.");
  }

  const { data: documents, error } = await supabase
    .from("documents")
    .insert(fichiers.map((f) => ({ nom: nomDepuisFichier(String(f.nomOriginal ?? "")), en_vrac: true })))
    .select("id");
  if (error || !documents || documents.length !== fichiers.length) {
    return fail("Les documents n'ont pas pu être enregistrés. Réessaie.");
  }

  const { error: fichiersError } = await supabase.from("document_fichiers").insert(
    fichiers.map((f, i) => ({
      document_id: documents[i].id,
      url: supabase.storage.from(BUCKET).getPublicUrl(f.path).data.publicUrl,
      fichier_type: f.path.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
      ordre: 0,
    }))
  );
  if (fichiersError) {
    await supabase.from("documents").delete().in("id", documents.map((d) => d.id));
    return fail("Les documents n'ont pas pu être enregistrés. Réessaie.");
  }

  revalidateVrac();
  return ok({ crees: documents.length });
}
