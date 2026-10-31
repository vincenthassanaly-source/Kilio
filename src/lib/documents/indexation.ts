// Indexation d'un document pour la recherche en langage naturel : Gemini lit
// ses fichiers et écrit une « fiche » texte, stockée dans documents_fiches
// (table à part, lisible côté serveur seulement : voir
// scripts/migration-documents-fiches-2026-10-31.sql).
//
// Logique serveur uniquement (clé service Supabase, clé Gemini) : importée par
// les actions, jamais par un composant client.
import { after } from "next/server";
import { FICHIERS_MAX_ANALYSE, TAILLE_MAX_ANALYSE_OCTETS } from "@/lib/documents/tri";
import { SCHEMA_FICHE, construirePromptFiche, lireFiche, signatureFichiers } from "@/lib/documents/recherche";
import { appelerGemini } from "@/lib/gemini/appel";
import { createAdminClient } from "@/lib/supabase/admin";

const TELECHARGEMENT_TIMEOUT_MS = 20_000;
// Plafond serré : la recherche rattrape plusieurs documents d'un coup, dans la
// durée maximale de la page Documents (60 s).
const GEMINI_FICHE_TIMEOUT_MS = 30_000;

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type ResultatIndexation =
  | { statut: "ok"; contenu: string | null }
  | { statut: "echec"; quota: boolean; detail: string };

function typeMime(fichierType: string, typeReponse: string | null): string {
  if (typeReponse?.startsWith("image/") || typeReponse === "application/pdf") return typeReponse;
  return fichierType === "pdf" ? "application/pdf" : "image/jpeg";
}

/**
 * Lit les fichiers d'un document avec Gemini et enregistre sa fiche. Ne refait
 * rien si les fichiers n'ont pas changé depuis la dernière lecture. Un document
 * sans fichier n'a pas de fiche (`contenu: null`). Ne lève jamais.
 */
export async function indexerDocument(supabase: SupabaseAdmin, id: string): Promise<ResultatIndexation> {
  try {
    const { data: document, error } = await supabase
      .from("documents")
      .select("nom, categorie, document_fichiers(url, fichier_type, ordre)")
      .eq("id", id)
      .order("ordre", { referencedTable: "document_fichiers", ascending: true })
      .maybeSingle();
    if (error) return { statut: "echec", quota: false, detail: "Le document n'a pas pu être lu." };
    if (!document) return { statut: "ok", contenu: null };

    const fichiers = document.document_fichiers as { url: string; fichier_type: string }[];
    if (fichiers.length === 0) {
      await supabase.from("documents_fiches").delete().eq("document_id", id);
      return { statut: "ok", contenu: null };
    }

    const signature = signatureFichiers(fichiers.map((f) => f.url));
    const { data: existante } = await supabase
      .from("documents_fiches")
      .select("contenu, signature")
      .eq("document_id", id)
      .maybeSingle();
    if (existante?.signature === signature) return { statut: "ok", contenu: existante.contenu };

    const images: { mimeType: string; data: string }[] = [];
    let total = 0;
    for (const fichier of fichiers.slice(0, FICHIERS_MAX_ANALYSE)) {
      const reponse = await fetch(fichier.url, { signal: AbortSignal.timeout(TELECHARGEMENT_TIMEOUT_MS) });
      if (!reponse.ok) return { statut: "echec", quota: false, detail: "Un fichier n'a pas pu être téléchargé." };
      const octets = Buffer.from(await reponse.arrayBuffer());
      total += octets.length;
      if (total > TAILLE_MAX_ANALYSE_OCTETS) {
        return { statut: "echec", quota: false, detail: "Fichiers trop volumineux pour être lus." };
      }
      images.push({ mimeType: typeMime(fichier.fichier_type, reponse.headers.get("content-type")), data: octets.toString("base64") });
    }

    const resultat = await appelerGemini({
      prompt: construirePromptFiche(document.nom, document.categorie),
      images,
      schema: SCHEMA_FICHE,
      timeoutMs: GEMINI_FICHE_TIMEOUT_MS,
      temperature: 0.1,
      etiquette: "fiche-document",
    });
    if (!resultat.ok) return { statut: "echec", quota: resultat.code === "quota", detail: resultat.detail };

    const contenu = lireFiche(resultat.brut);
    if (!contenu) return { statut: "echec", quota: false, detail: "Réponse de Gemini inutilisable." };

    const { error: ecritureError } = await supabase
      .from("documents_fiches")
      .upsert({ document_id: id, contenu, signature, updated_at: new Date().toISOString() });
    if (ecritureError) {
      console.error("indexerDocument: fiche non enregistrée", ecritureError);
      return { statut: "echec", quota: false, detail: "La fiche n'a pas pu être enregistrée." };
    }
    return { statut: "ok", contenu };
  } catch (err) {
    console.error("indexerDocument", err);
    return { statut: "echec", quota: false, detail: "Lecture du document impossible." };
  }
}

/**
 * Planifie l'indexation après la réponse en cours (`after`). Hors requête
 * (tests, script), `after` lève : l'indexation est alors simplement sautée,
 * la recherche rattrapant de toute façon les fiches manquantes.
 */
export function planifierIndexation(ids: readonly string[]): void {
  if (ids.length === 0) return;
  try {
    after(() => indexerEnArrierePlan(ids));
  } catch {
    // Pas de contexte de requête : rien à planifier.
  }
}

/**
 * Indexe des documents juste après leur ajout ou leur classement, sans bloquer
 * la réponse à l'utilisateur (appelée dans `after()`). Les échecs sont sans
 * conséquence : la recherche rattrape les fiches manquantes.
 */
export async function indexerEnArrierePlan(ids: readonly string[]): Promise<void> {
  const supabase = createAdminClient();
  for (const id of ids) {
    const resultat = await indexerDocument(supabase, id);
    if (resultat.statut === "echec") {
      console.warn(`[fiche-document] ${id} : ${resultat.detail}`);
      if (resultat.quota) return;
    }
  }
}
