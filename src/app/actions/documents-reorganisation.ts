"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  DOCUMENTS_MAX_REORGANISATION,
  SCHEMA_REORGANISATION,
  construirePromptReorganisation,
  lireReponseReorganisation,
  nettoyerInstruction,
  type Changement,
} from "@/lib/documents/reorganisation";
import { CATEGORIE_MAX, nettoyerTexte, trouverCategorie } from "@/lib/documents/tri";
import { appelerGemini, MESSAGE_QUOTA_GEMINI } from "@/lib/gemini/appel";
import { createAdminClient } from "@/lib/supabase/admin";

// Réorganisation des catégories avec Gemini, en trois temps : `proposerReorganisation`
// (lecture seule, un seul appel Gemini sur les métadonnées), `appliquerReorganisation`
// (n'écrit que ce que l'aperçu a validé) et `annulerReorganisation` (remet tout en
// place). Seuls les documents classés bougent : ceux du vrac ont leur propre tri.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GEMINI_TIMEOUT_MS = 50_000;
const DOCUMENTS_MIN = 2;

function revalidateReorganisation() {
  revalidatePath("/documents");
  revalidatePath("/documents/categories");
}

// --- Proposition (lecture seule) ---

// Discriminant `statut` et non `ok` : voir le commentaire de `ResultatAnalyse`
// dans documents-vrac.ts (`runAction` prend toute réponse `{ ok: true, … }` pour
// son propre contrat et la renvoie sans `data`).
export type ResultatProposition =
  | {
      statut: "ok";
      changements: Changement[];
      /** Documents par catégorie, vrac compris : sert à repérer les catégories qui se vident. */
      comptes: Record<string, number>;
      analyses: number;
      /** Plus de documents classés que la limite d'un appel : les plus récents seulement. */
      tronque: boolean;
    }
  | { statut: "echec"; erreur: string; quota: boolean };

function echec(erreur: string, quota = false): ResultatProposition {
  return { statut: "echec", erreur, quota };
}

export async function proposerReorganisation(instruction: string = ""): Promise<ResultatProposition> {
  const supabase = createAdminClient();
  const [documentsResult, categoriesResult] = await Promise.all([
    supabase
      .from("documents")
      .select("id, nom, categorie, notes, en_vrac, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("documents_categories").select("nom"),
  ]);
  if (documentsResult.error || categoriesResult.error) return echec("Les documents n'ont pas pu être lus. Réessaie.");

  const tous = documentsResult.data ?? [];
  const classes = tous.filter((d) => !d.en_vrac);
  if (classes.length < DOCUMENTS_MIN) return echec("Il faut au moins deux documents classés pour réorganiser.");

  const comptes: Record<string, number> = {};
  for (const { categorie } of tous) if (categorie) comptes[categorie] = (comptes[categorie] ?? 0) + 1;

  const tronque = classes.length > DOCUMENTS_MAX_REORGANISATION;
  const analyses = classes.slice(0, DOCUMENTS_MAX_REORGANISATION).map((d) => ({
    id: d.id,
    nom: d.nom,
    categorie: d.categorie,
    notes: d.notes,
  }));
  const categories = (categoriesResult.data ?? []).map((c) => c.nom);

  const resultat = await appelerGemini({
    prompt: construirePromptReorganisation(analyses, categories, nettoyerInstruction(instruction)),
    schema: SCHEMA_REORGANISATION,
    timeoutMs: GEMINI_TIMEOUT_MS,
    temperature: 0.2,
    etiquette: "reorganisation-documents",
  });
  if (!resultat.ok) {
    return resultat.code === "quota"
      ? echec(MESSAGE_QUOTA_GEMINI, true)
      : echec(`Gemini n'a pas pu proposer de réorganisation (${resultat.detail})`);
  }

  return {
    statut: "ok",
    changements: lireReponseReorganisation(resultat.brut, analyses, categories),
    comptes,
    analyses: analyses.length,
    tronque,
  };
}

// --- Application (écriture) ---

export type DeplacementValide = { id: string; vers: string };
export type Ancien = { id: string; de: string | null };
export type ResultatApplication = {
  appliques: number;
  echecs: number;
  /** Pourquoi le premier déplacement a échoué (null s'il n'y a aucun échec). */
  raison: string | null;
  /** Catégorie d'origine de chaque document déplacé : de quoi annuler. */
  anciennes: Ancien[];
  creees: string[];
  supprimees: string[];
};

export async function appliquerReorganisation(
  deplacements: DeplacementValide[],
  supprimerVides: boolean
): Promise<ActionResult<ResultatApplication>> {
  if (!Array.isArray(deplacements) || deplacements.length === 0) return fail("Rien à appliquer.");
  if (deplacements.length > DOCUMENTS_MAX_REORGANISATION) return fail("Trop de documents d'un coup.");

  const valides: DeplacementValide[] = [];
  for (const deplacement of deplacements) {
    const vers = nettoyerTexte(deplacement?.vers).slice(0, CATEGORIE_MAX);
    if (!UUID.test(String(deplacement?.id)) || !vers) return fail("Un des déplacements est invalide.");
    valides.push({ id: deplacement.id, vers });
  }

  const supabase = createAdminClient();

  // Catégorie actuelle de chaque document, lue maintenant : c'est elle que
  // l'annulation remettra, même si le document a changé depuis l'aperçu.
  const { data: courants, error: lectureError } = await supabase
    .from("documents")
    .select("id, categorie")
    .in("id", valides.map((v) => v.id))
    .eq("en_vrac", false);
  if (lectureError) return fail("La réorganisation n'a pas pu être appliquée. Réessaie.");
  const actuelles = new Map((courants ?? []).map((d) => [d.id, d.categorie as string | null]));

  // Catégories nouvelles : créées maintenant (et seulement maintenant), une fois
  // l'aperçu validé. Casse et accents ignorés pour ne pas dupliquer.
  const { data: existantes, error: categoriesError } = await supabase.from("documents_categories").select("nom");
  if (categoriesError) return fail("La réorganisation n'a pas pu être appliquée. Réessaie.");
  const connues = (existantes ?? []).map((c) => c.nom);
  const creees: string[] = [];
  for (const { vers } of valides) {
    if (!trouverCategorie(vers, connues) && !trouverCategorie(vers, creees)) creees.push(vers);
  }
  if (creees.length > 0) {
    const { error } = await supabase.from("documents_categories").insert(creees.map((nom) => ({ nom })));
    if (error) return fail("Les nouvelles catégories n'ont pas pu être créées. Réessaie.");
  }
  const toutes = [...connues, ...creees];

  const parCategorie = new Map<string, string[]>();
  let raison: string | null = null;
  for (const { id, vers } of valides) {
    if (!actuelles.has(id)) {
      raison ??= "déjà sorti du classement ou supprimé";
      continue;
    }
    const finale = trouverCategorie(vers, toutes) ?? vers;
    parCategorie.set(finale, [...(parCategorie.get(finale) ?? []), id]);
  }

  const anciennes: Ancien[] = [];
  const utilisees: string[] = [];
  for (const [categorie, ids] of parCategorie) {
    const { data, error } = await supabase
      .from("documents")
      .update({ categorie })
      .in("id", ids)
      .eq("en_vrac", false)
      .select("id");
    if (error) {
      // 23514 = check_violation : la base refuse la valeur de `categorie`.
      console.error("appliquerReorganisation: mise à jour refusée", error);
      raison ??= error.code === "23514" ? "catégorie refusée par la base" : "erreur de la base";
      continue;
    }
    for (const { id } of data ?? []) anciennes.push({ id, de: actuelles.get(id) ?? null });
    if ((data?.length ?? 0) > 0) utilisees.push(categorie);
  }

  // Catégories créées pendant cet essai mais jamais utilisées (échec) : retirées.
  const inutilisees = creees.filter((nom) => !trouverCategorie(nom, utilisees));
  if (inutilisees.length > 0) {
    const { error } = await supabase.from("documents_categories").delete().in("nom", inutilisees);
    if (error) console.error("appliquerReorganisation: catégories inutilisées non retirées", error);
  }

  // Catégories d'où des documents sont partis et qui n'en contiennent plus aucun.
  const supprimees: string[] = [];
  if (supprimerVides) {
    const sources = [...new Set(anciennes.map((a) => a.de).filter((nom): nom is string => nom !== null))];
    for (const nom of sources) {
      const { count, error } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("categorie", nom);
      if (!error && count === 0) supprimees.push(nom);
    }
    if (supprimees.length > 0) {
      const { error } = await supabase.from("documents_categories").delete().in("nom", supprimees);
      if (error) {
        console.error("appliquerReorganisation: catégories vides non supprimées", error);
        supprimees.length = 0;
      }
    }
  }

  revalidateReorganisation();
  return ok({
    appliques: anciennes.length,
    echecs: valides.length - anciennes.length,
    raison,
    anciennes,
    creees: creees.filter((nom) => trouverCategorie(nom, utilisees)),
    supprimees,
  });
}

// --- Annulation ---

export async function annulerReorganisation(
  anciennes: Ancien[],
  creees: string[],
  supprimees: string[]
): Promise<ActionResult<{ restaures: number }>> {
  if (!Array.isArray(anciennes) || anciennes.length === 0 || anciennes.length > DOCUMENTS_MAX_REORGANISATION) {
    return fail("Rien à annuler.");
  }
  const documents: Ancien[] = [];
  for (const ancien of anciennes) {
    const de = ancien?.de === null ? null : nettoyerTexte(ancien?.de).slice(0, CATEGORIE_MAX);
    if (!UUID.test(String(ancien?.id)) || de === "") return fail("Annulation impossible.");
    documents.push({ id: ancien.id, de });
  }
  const noms = (valeurs: unknown) =>
    (Array.isArray(valeurs) ? valeurs : []).map((n) => nettoyerTexte(n).slice(0, CATEGORIE_MAX)).filter(Boolean);
  const aSupprimer = noms(creees);
  const aRecreer = noms(supprimees);

  const supabase = createAdminClient();

  // 1. Les catégories supprimées reviennent d'abord, pour que les documents
  //    puissent y retourner.
  if (aRecreer.length > 0) {
    const { data: existantes, error } = await supabase.from("documents_categories").select("nom");
    if (error) return fail("L'annulation n'a pas pu être faite. Réessaie.");
    const connues = (existantes ?? []).map((c) => c.nom);
    const manquantes = aRecreer.filter((nom) => !trouverCategorie(nom, connues));
    if (manquantes.length > 0) {
      const { error: insertError } = await supabase.from("documents_categories").insert(manquantes.map((nom) => ({ nom })));
      if (insertError) return fail("L'annulation n'a pas pu être faite. Réessaie.");
    }
  }

  // 2. Chaque document retrouve sa catégorie d'origine.
  const parOrigine = new Map<string | null, string[]>();
  for (const { id, de } of documents) parOrigine.set(de, [...(parOrigine.get(de) ?? []), id]);
  let restaures = 0;
  let partiel = false;
  for (const [categorie, ids] of parOrigine) {
    const { data, error } = await supabase.from("documents").update({ categorie }).in("id", ids).select("id");
    if (error) {
      console.error("annulerReorganisation: mise à jour refusée", error);
      partiel = true;
      continue;
    }
    restaures += data?.length ?? 0;
  }

  // 3. Les catégories que la réorganisation avait créées, si elles sont vides.
  for (const nom of aSupprimer) {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("categorie", nom);
    if (!error && count === 0) await supabase.from("documents_categories").delete().eq("nom", nom);
  }

  revalidateReorganisation();
  if (partiel) return fail("L'annulation n'a été que partielle. Réessaie ou corrige à la main.");
  return ok({ restaures });
}
