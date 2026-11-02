// Description d'un document à la demande : Gemini lit ses fichiers et écrit un
// résumé simple suivi de puces (voir description.ts). Le résultat est
// enregistré dans documents_descriptions (voir
// scripts/migration-documents-descriptions-2026-11-02.sql) puis relu sans
// nouvel appel tant que les fichiers ne changent pas.
//
// Logique serveur uniquement (clé service Supabase, clé Gemini) : importée par
// l'action, jamais par un composant client.
import {
  SCHEMA_DESCRIPTION,
  construirePromptDescription,
  lireDescription,
  type DescriptionDocument,
} from "@/lib/documents/description";
import { telechargerPourGemini } from "@/lib/documents/indexation";
import { signatureFichiers } from "@/lib/documents/recherche";
import { FICHIERS_MAX_ANALYSE } from "@/lib/documents/tri";
import { appelerGemini } from "@/lib/gemini/appel";
import { createAdminClient } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const GEMINI_DESCRIPTION_TIMEOUT_MS = 30_000;

export type ResultatDescription =
  | {
      statut: "ok";
      description: DescriptionDocument;
      /** Seuls les premiers fichiers ont été lus (le document en compte davantage). */
      partiel: boolean;
    }
  | { statut: "echec"; quota: boolean; detail: string };

/**
 * Renvoie la description d'un document : celle déjà enregistrée si les
 * fichiers n'ont pas changé (sauf `regenerer`), sinon une nouvelle écrite par
 * Gemini. Ne lève jamais.
 */
export async function decrireDocument(
  supabase: SupabaseAdmin,
  id: string,
  regenerer = false
): Promise<ResultatDescription> {
  try {
    const { data: document, error } = await supabase
      .from("documents")
      .select("nom, categorie, document_fichiers(url, fichier_type, ordre)")
      .eq("id", id)
      .order("ordre", { referencedTable: "document_fichiers", ascending: true })
      .maybeSingle();
    if (error) return { statut: "echec", quota: false, detail: "Le document n'a pas pu être lu." };
    if (!document) return { statut: "echec", quota: false, detail: "Ce document n'existe plus." };

    const fichiers = document.document_fichiers as { url: string; fichier_type: string }[];
    if (fichiers.length === 0) {
      return { statut: "echec", quota: false, detail: "Ce document n'a aucun fichier à lire." };
    }
    const partiel = fichiers.length > FICHIERS_MAX_ANALYSE;
    const signature = signatureFichiers(fichiers.map((f) => f.url));

    if (!regenerer) {
      const { data: existante } = await supabase
        .from("documents_descriptions")
        .select("contenu, signature")
        .eq("document_id", id)
        .maybeSingle();
      if (existante?.signature === signature) {
        const description = lireDescription(existante.contenu);
        if (description) return { statut: "ok", description, partiel };
      }
    }

    const telechargement = await telechargerPourGemini(fichiers);
    if (!telechargement.ok) return { statut: "echec", quota: false, detail: telechargement.detail };

    const resultat = await appelerGemini({
      prompt: construirePromptDescription(document.nom, document.categorie),
      images: telechargement.images,
      schema: SCHEMA_DESCRIPTION,
      timeoutMs: GEMINI_DESCRIPTION_TIMEOUT_MS,
      temperature: 0.2,
      etiquette: "description-document",
    });
    if (!resultat.ok) return { statut: "echec", quota: resultat.code === "quota", detail: resultat.detail };

    const description = lireDescription(resultat.brut);
    if (!description) return { statut: "echec", quota: false, detail: "Réponse de Gemini inutilisable." };

    const { error: ecritureError } = await supabase
      .from("documents_descriptions")
      .upsert({ document_id: id, contenu: description, signature, updated_at: new Date().toISOString() });
    // Description non enregistrée (table absente, base indisponible) : elle
    // est quand même affichée, le prochain clic la recalculera.
    if (ecritureError) console.error("decrireDocument: description non enregistrée", ecritureError);

    return { statut: "ok", description, partiel };
  } catch (err) {
    console.error("decrireDocument", err);
    return { statut: "echec", quota: false, detail: "Lecture du document impossible." };
  }
}
