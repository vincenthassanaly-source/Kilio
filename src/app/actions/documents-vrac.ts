"use server";

import { createHash } from "node:crypto";
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
  trouverDoublonParTitre,
  type DoublonDetecte,
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

// Discriminant `statut` et non `ok` : l'action est appelée à travers
// `runAction` (src/lib/actions/runAction.ts), qui prend toute réponse
// `{ ok: true, … }` pour son propre contrat `ActionResult` et la renvoie telle
// quelle, sans `data`. Avec `ok`, le modal de tri lisait `data` indéfini et
// restait figé à « 0 / 1 ».
export type ResultatAnalyse =
  | { statut: "ok"; proposition: PropositionTri; doublon: DoublonDetecte | null }
  | { statut: "echec"; erreur: string; quota: boolean };

function echecAnalyse(erreur: string, quota = false): ResultatAnalyse {
  return { statut: "echec", erreur, quota };
}

type EntreeFichier = { id: string; url: string; fichier_type: string };

function typeMime(fichier: Pick<EntreeFichier, "fichier_type">, typeReponse: string | null): string {
  if (typeReponse?.startsWith("image/") || typeReponse === "application/pdf") return typeReponse;
  return fichier.fichier_type === "pdf" ? "application/pdf" : "image/jpeg";
}

// --- Doublons ---
// Un fichier est un doublon s'il a la même empreinte SHA-256 qu'un fichier
// d'un autre document : octet pour octet, donc certain. L'empreinte est
// calculée ici, quand le tri télécharge déjà le fichier pour Gemini, et
// mémorisée dans document_fichiers.empreinte (scripts/migration-documents-
// empreinte-2026-10-29.sql). Les fichiers des documents classés qui n'en ont
// pas encore sont complétés au fil des tris, par petits paquets.

const EMPREINTES_RATTRAPAGE_MAX = 15;
const RATTRAPAGE_PARALLELE = 5;
const RATTRAPAGE_TAILLE_MAX_OCTETS = 30 * 1024 * 1024;

function empreinteSha256(octets: Buffer): string {
  return createHash("sha256").update(octets).digest("hex");
}

type LigneFichier = {
  id: string;
  url: string;
  empreinte: string | null;
  document_id: string;
  documents: { nom: string; categorie: string | null; en_vrac: boolean } | null;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/** Complète l'empreinte d'un fichier déjà stocké ; sans effet (null) au moindre souci. */
async function calculerEmpreinteExistante(supabase: SupabaseAdmin, ligne: LigneFichier): Promise<string | null> {
  try {
    const reponse = await fetch(ligne.url, { signal: AbortSignal.timeout(TELECHARGEMENT_TIMEOUT_MS) });
    if (!reponse.ok) return null;
    if (Number(reponse.headers.get("content-length")) > RATTRAPAGE_TAILLE_MAX_OCTETS) return null;
    const empreinte = empreinteSha256(Buffer.from(await reponse.arrayBuffer()));
    await supabase.from("document_fichiers").update({ empreinte }).eq("id", ligne.id);
    return empreinte;
  } catch {
    return null;
  }
}

/**
 * Document dont un fichier est identique à l'un des fichiers analysés, parmi
 * tous les autres documents (classés ou déjà analysés dans le vrac). Les
 * fichiers du vrac pas encore analysés ne sont pas complétés ici : le premier
 * analysé d'un lot de copies reste l'original, les suivants sont les doublons.
 * Renvoie null (pas de détection par fichier) si la colonne n'existe pas encore.
 */
async function chercherDoublonFichier(
  supabase: SupabaseAdmin,
  documentId: string,
  empreintes: string[]
): Promise<{ detecte: DoublonDetecte; categorie: string | null } | null> {
  const { data, error } = await supabase
    .from("document_fichiers")
    .select("id, url, empreinte, document_id, documents(nom, categorie, en_vrac)")
    .neq("document_id", documentId);
  if (error) return null;
  const lignes = (data ?? []) as unknown as LigneFichier[];

  const connues = new Map<string, LigneFichier>();
  for (const ligne of lignes) if (ligne.empreinte) connues.set(ligne.empreinte, ligne);

  const manquantes = lignes
    .filter((ligne) => !ligne.empreinte && ligne.documents && !ligne.documents.en_vrac)
    .slice(0, EMPREINTES_RATTRAPAGE_MAX);
  for (let i = 0; i < manquantes.length; i += RATTRAPAGE_PARALLELE) {
    const paquet = manquantes.slice(i, i + RATTRAPAGE_PARALLELE);
    const calculees = await Promise.all(paquet.map((ligne) => calculerEmpreinteExistante(supabase, ligne)));
    paquet.forEach((ligne, index) => {
      const empreinte = calculees[index];
      if (empreinte) connues.set(empreinte, { ...ligne, empreinte });
    });
  }

  for (const empreinte of empreintes) {
    const trouvee = connues.get(empreinte);
    if (trouvee) {
      return {
        detecte: { type: "fichier", documentId: trouvee.document_id, nom: trouvee.documents?.nom ?? "" },
        categorie: trouvee.documents?.categorie ?? null,
      };
    }
  }
  return null;
}

export async function analyserDocumentVrac(id: string, categoriesSupplementaires: string[] = []): Promise<ResultatAnalyse> {
  if (!UUID.test(id)) return echecAnalyse("Document introuvable.");

  const supabase = createAdminClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("nom, en_vrac, document_fichiers(id, url, fichier_type, ordre)")
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
  const empreintes: { id: string; empreinte: string }[] = [];
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
    empreintes.push({ id: fichier.id, empreinte: empreinteSha256(octets) });
  }

  // Mémorise l'empreinte (au mieux : sans la colonne, l'écriture échoue sans
  // conséquence) avant de chercher un doublon, pour que les documents
  // analysés ensuite dans le même lot retrouvent celui-ci.
  await Promise.all(
    empreintes.map(({ id: fichierId, empreinte }) =>
      supabase.from("document_fichiers").update({ empreinte }).eq("id", fichierId)
    )
  );
  const doublonFichier = await chercherDoublonFichier(
    supabase,
    id,
    empreintes.map((e) => e.empreinte)
  );
  if (doublonFichier) {
    // Même fichier qu'un document existant : inutile de consommer le quota Gemini.
    // La proposition reprend le nom et la catégorie de l'original.
    return {
      statut: "ok",
      proposition: { nom: doublonFichier.detecte.nom || document.nom, categorie: doublonFichier.categorie, nouvelleCategorie: false },
      doublon: doublonFichier.detecte,
    };
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
  const proposition = lireReponseTri(resultat.brut, categories, document.nom);

  // Titre identique à celui d'un document déjà classé : doublon probable (le
  // même document peut avoir été renvoyé sous une autre forme, ex. une photo
  // au lieu du PDF). Le vrac est exclu : ses noms sont ceux des fichiers reçus.
  const { data: classes } = await supabase.from("documents").select("id, nom").eq("en_vrac", false).neq("id", id);
  return { statut: "ok", proposition, doublon: trouverDoublonParTitre(proposition.nom, classes ?? []) };
}

// --- Remise en vrac (bouton « Remettre en vrac », et son annulation) ---
// Ne change que le drapeau : nom, catégorie, étiquette, échéance et notes restent
// en place jusqu'à un éventuel tri, dont seuls le nom et la catégorie sont remplacés.

export async function definirDocumentEnVrac(id: string, enVrac: boolean): Promise<ActionResult<undefined>> {
  if (!UUID.test(id)) return fail("Document introuvable.");

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("documents").update({ en_vrac: enVrac }).eq("id", id).select("id");
  if (error) {
    return fail(
      enVrac
        ? "Le document n'a pas pu être remis en vrac. Réessaie."
        : "La remise en vrac n'a pas pu être annulée. Réessaie."
    );
  }
  if (!data || data.length === 0) return fail("Document introuvable.");

  revalidateVrac([id]);
  return ok();
}

// --- Application (écriture) ---

export type ElementTriValide = { id: string; nom: string; categorie: string | null };
/** `raison` : pourquoi le premier document a échoué (null s'il n'y a aucun échec). */
export type ResultatApplication = { appliques: number; echecs: number; raison: string | null };

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
  let raison: string | null = null;
  const utilisees: string[] = [];
  for (const { id, nom, categorie } of valides) {
    const categorieFinale = categorie ? (trouverCategorie(categorie, toutes) ?? categorie) : null;
    const { data, error } = await supabase
      .from("documents")
      .update({ nom, categorie: categorieFinale, en_vrac: false })
      .eq("id", id)
      .eq("en_vrac", true)
      .select("id");
    if (error) {
      // 23514 = check_violation : la base refuse la valeur (ex. une contrainte
      // sur `categorie`, qui avait bloqué le tri des catégories nouvelles).
      console.error("appliquerTriVrac: mise à jour refusée", error);
      raison ??= error.code === "23514" ? "catégorie refusée par la base" : "erreur de la base";
      continue;
    }
    if ((data?.length ?? 0) === 0) {
      raison ??= "déjà sorti du vrac ou supprimé";
      continue;
    }
    appliques += 1;
    if (categorieFinale) utilisees.push(categorieFinale);
  }

  // Catégories créées pendant cet essai mais finalement jamais utilisées (échec
  // d'application) : retirées, pour ne pas laisser de catégories orphelines.
  const inutilisees = aCreer.filter((nom) => !trouverCategorie(nom, utilisees));
  if (inutilisees.length > 0) {
    const { error } = await supabase.from("documents_categories").delete().in("nom", inutilisees);
    if (error) console.error("appliquerTriVrac: catégories inutilisées non retirées", error);
  }

  revalidateVrac(valides.map((v) => v.id));
  return ok({ appliques, echecs: valides.length - appliques, raison });
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
