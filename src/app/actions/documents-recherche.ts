"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { indexerDocument } from "@/lib/documents/indexation";
import {
  DOCUMENTS_MAX_RECHERCHE,
  QUESTION_MAX,
  RATTRAPAGE_MAX,
  SCHEMA_RECHERCHE,
  construirePromptRecherche,
  lireReponseRecherche,
  signatureFichiers,
  type DocumentRecherche,
} from "@/lib/documents/recherche";
import { nettoyerTexte } from "@/lib/documents/tri";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { createAdminClient } from "@/lib/supabase/admin";

// Recherche en langage naturel : Gemini choisit, parmi les documents classés,
// ceux qui répondent à la question (aucun, un ou plusieurs), à partir de leur
// nom, catégorie, notes et de leur « fiche » (texte lu dans les fichiers).
// Les fiches manquantes ou périmées (fichiers changés) sont refaites au passage :
// c'est ce qui indexe les documents déjà présents. Les fiches ne sont jamais
// renvoyées au navigateur, seulement les identifiants retenus.

const GEMINI_RECHERCHE_TIMEOUT_MS = 20_000;

export type ResultatRecherche = {
  /** Documents retenus, du plus au moins pertinent. */
  ids: string[];
  /** Documents que Gemini n'a pas pu lire : cherchés par leur nom et leurs notes seulement. */
  nonLus: number;
};

type LigneDocument = {
  id: string;
  nom: string;
  categorie: string | null;
  notes: string | null;
  document_fichiers: { url: string; ordre: number }[];
};

export async function rechercherDocuments(question: string): Promise<ActionResult<ResultatRecherche>> {
  const demande = nettoyerTexte(question).slice(0, QUESTION_MAX);
  if (!demande) return fail("Écris ce que tu cherches.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, nom, categorie, notes, document_fichiers(url, ordre)")
    .eq("en_vrac", false)
    .order("created_at", { ascending: false })
    .order("ordre", { referencedTable: "document_fichiers", ascending: true })
    .limit(DOCUMENTS_MAX_RECHERCHE);
  if (error) return fail("Les documents n'ont pas pu être lus. Réessaie.");
  const documents = (data ?? []) as unknown as LigneDocument[];
  if (documents.length === 0) return ok({ ids: [], nonLus: 0 });

  const { data: lignesFiches, error: fichesError } = await supabase
    .from("documents_fiches")
    .select("document_id, contenu, signature")
    .in("document_id", documents.map((d) => d.id));
  if (fichesError) {
    console.error("rechercherDocuments: fiches illisibles", fichesError);
    return fail("La recherche par IA n'est pas disponible pour le moment.");
  }
  const fiches = new Map<string, { contenu: string; signature: string }>();
  for (const ligne of lignesFiches ?? []) fiches.set(ligne.document_id, ligne);

  // Rattrapage : documents avec fichiers dont la fiche manque ou ne correspond plus.
  const aLire = documents
    .filter((d) => {
      if (d.document_fichiers.length === 0) return false;
      return fiches.get(d.id)?.signature !== signatureFichiers(d.document_fichiers.map((f) => f.url));
    })
    .slice(0, RATTRAPAGE_MAX);
  const lectures = await Promise.all(aLire.map((d) => indexerDocument(supabase, d.id)));
  aLire.forEach((d, index) => {
    const lecture = lectures[index];
    if (lecture.statut === "ok" && lecture.contenu) {
      fiches.set(d.id, { contenu: lecture.contenu, signature: "" });
    }
  });

  const aChercher: DocumentRecherche[] = documents.map((d) => ({
    id: d.id,
    nom: d.nom,
    categorie: d.categorie,
    notes: d.notes,
    fiche: fiches.get(d.id)?.contenu ?? null,
  }));
  const nonLus = documents.filter((d) => d.document_fichiers.length > 0 && !fiches.has(d.id)).length;

  const resultat = await appelerGemini({
    prompt: construirePromptRecherche(demande, aChercher),
    schema: SCHEMA_RECHERCHE,
    timeoutMs: GEMINI_RECHERCHE_TIMEOUT_MS,
    temperature: 0,
    etiquette: "recherche-documents",
  });
  if (!resultat.ok) {
    return fail(
      resultat.code === "quota"
        ? MESSAGE_QUOTA_GEMINI
        : `La recherche par l'IA n'a pas abouti (${resultat.detail}). Réessaie.`
    );
  }

  return ok({
    ids: lireReponseRecherche(
      resultat.brut,
      documents.map((d) => d.id)
    ),
    nonLus,
  });
}
