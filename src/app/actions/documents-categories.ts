"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { CATEGORIE_MAX, CATEGORIES_PAR_DEFAUT, nettoyerTexte, trouverCategorie } from "@/lib/documents/tri";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

// Catégories de documents (table documents_categories, créée par
// scripts/migration-documents-vrac-2026-10-29.sql). `documents.categorie`
// reste le texte du nom : renommer, fusionner ou supprimer une catégorie met
// donc aussi à jour les documents ici. Aucun document n'est jamais supprimé
// par une opération sur une catégorie.

export type CategorieAvecCompte = Tables<"documents_categories"> & { nb: number };

function revalidateCategoriesPaths() {
  revalidatePath("/documents");
  revalidatePath("/documents/categories");
}

export async function getCategories(): Promise<Tables<"documents_categories">[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("documents_categories").select("*").order("nom", { ascending: true });
  if (error) {
    // Table absente : migration pas encore appliquée. On garde les catégories
    // d'origine plutôt que de faire planter toute la page Documents.
    console.error("getCategories: documents_categories illisible, repli sur les catégories d'origine", error.message);
    return CATEGORIES_PAR_DEFAUT.map((nom) => ({ id: `defaut:${nom}`, nom, created_at: "" })).sort((a, b) =>
      a.nom.localeCompare(b.nom, "fr")
    );
  }
  return (data ?? []).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export async function getCategoriesAvecCompte(): Promise<CategorieAvecCompte[]> {
  const supabase = createAdminClient();
  const [categories, { data, error }] = await Promise.all([
    getCategories(),
    supabase.from("documents").select("categorie").not("categorie", "is", null),
  ]);
  if (error) throw new Error(error.message);
  const comptes = new Map<string, number>();
  for (const { categorie } of data ?? []) {
    if (categorie) comptes.set(categorie, (comptes.get(categorie) ?? 0) + 1);
  }
  return categories.map((c) => ({ ...c, nb: comptes.get(c.nom) ?? 0 }));
}

function nomValide(nom: string): string | null {
  const propre = nettoyerTexte(nom);
  return propre && propre.length <= CATEGORIE_MAX ? propre : null;
}

export async function creerCategorie(nom: string): Promise<ActionResult<undefined>> {
  const propre = nomValide(nom);
  if (!propre) return fail(`Le nom est requis (${CATEGORIE_MAX} caractères maximum).`);

  const supabase = createAdminClient();
  const { data: existantes, error: lectureError } = await supabase.from("documents_categories").select("nom");
  if (lectureError) return fail("La catégorie n'a pas pu être créée. Réessaie.");
  if (trouverCategorie(propre, (existantes ?? []).map((c) => c.nom))) return fail("Cette catégorie existe déjà.");

  const { error } = await supabase.from("documents_categories").insert({ nom: propre });
  if (error) return fail("La catégorie n'a pas pu être créée. Réessaie.");

  revalidateCategoriesPaths();
  return ok();
}

export async function renommerCategorie(id: string, nom: string): Promise<ActionResult<undefined>> {
  const propre = nomValide(nom);
  if (!propre) return fail(`Le nom est requis (${CATEGORIE_MAX} caractères maximum).`);

  const supabase = createAdminClient();
  const { data: toutes, error: lectureError } = await supabase.from("documents_categories").select("id, nom");
  if (lectureError) return fail("La catégorie n'a pas pu être renommée. Réessaie.");
  const actuelle = (toutes ?? []).find((c) => c.id === id);
  if (!actuelle) return fail("Catégorie introuvable.");
  if (actuelle.nom === propre) return ok();

  // Une autre catégorie déjà nommée ainsi (casse et accents ignorés) : c'est
  // une fusion à faire, pas un renommage. Changer seulement la casse ou les
  // accents de la catégorie elle-même reste permis.
  const autres = (toutes ?? []).filter((c) => c.id !== id).map((c) => c.nom);
  if (trouverCategorie(propre, autres)) return fail("Une catégorie porte déjà ce nom : fusionne-les plutôt.");

  const { error } = await supabase.from("documents_categories").update({ nom: propre }).eq("id", id);
  if (error) return fail("La catégorie n'a pas pu être renommée. Réessaie.");

  const { error: documentsError } = await supabase
    .from("documents")
    .update({ categorie: propre })
    .eq("categorie", actuelle.nom);
  if (documentsError) {
    // Catégorie renommée mais documents pas suivis : on remet l'ancien nom
    // pour ne pas laisser des documents rattachés à une catégorie inexistante.
    await supabase.from("documents_categories").update({ nom: actuelle.nom }).eq("id", id);
    return fail("La catégorie n'a pas pu être renommée. Réessaie.");
  }

  revalidateCategoriesPaths();
  return ok();
}

// Les documents de la catégorie supprimée n'ont plus de catégorie.
export async function supprimerCategorie(id: string): Promise<ActionResult<undefined>> {
  const supabase = createAdminClient();
  const { data: categorie, error: lectureError } = await supabase
    .from("documents_categories")
    .select("nom")
    .eq("id", id)
    .maybeSingle();
  if (lectureError) return fail("La catégorie n'a pas pu être supprimée. Réessaie.");
  if (!categorie) return ok();

  const { error: documentsError } = await supabase
    .from("documents")
    .update({ categorie: null })
    .eq("categorie", categorie.nom);
  if (documentsError) return fail("La catégorie n'a pas pu être supprimée. Réessaie.");

  const { error } = await supabase.from("documents_categories").delete().eq("id", id);
  if (error) return fail("La catégorie n'a pas pu être supprimée. Réessaie.");

  revalidateCategoriesPaths();
  return ok();
}

// Reverse les documents de `sourceId` dans `cibleId`, puis supprime la source.
export async function fusionnerCategories(sourceId: string, cibleId: string): Promise<ActionResult<undefined>> {
  if (sourceId === cibleId) return fail("Choisis deux catégories différentes.");

  const supabase = createAdminClient();
  const { data: categories, error: lectureError } = await supabase
    .from("documents_categories")
    .select("id, nom")
    .in("id", [sourceId, cibleId]);
  if (lectureError) return fail("Les catégories n'ont pas pu être fusionnées. Réessaie.");
  const source = (categories ?? []).find((c) => c.id === sourceId);
  const cible = (categories ?? []).find((c) => c.id === cibleId);
  if (!source || !cible) return fail("Catégorie introuvable.");

  const { error: documentsError } = await supabase
    .from("documents")
    .update({ categorie: cible.nom })
    .eq("categorie", source.nom);
  if (documentsError) return fail("Les catégories n'ont pas pu être fusionnées. Réessaie.");

  const { error } = await supabase.from("documents_categories").delete().eq("id", sourceId);
  if (error) return fail("Les catégories n'ont pas pu être fusionnées. Réessaie.");

  revalidateCategoriesPaths();
  return ok();
}
