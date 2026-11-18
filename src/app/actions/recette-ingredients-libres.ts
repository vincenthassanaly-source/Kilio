"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECETTES_TAG } from "@/lib/nutrition/tags";

export type IngredientLibreFormState = { error: string | null };

function revalidateRecette(recette_id: string) {
  revalidatePath("/nutrition/recettes");
  updateTag(RECETTES_TAG);
  revalidatePath(`/nutrition/recettes/${recette_id}`);
}

export async function addIngredientLibre(
  _prevState: IngredientLibreFormState,
  formData: FormData
): Promise<IngredientLibreFormState> {
  const recette_id = String(formData.get("recette_id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const quantiteRaw = String(formData.get("quantite") ?? "").trim();

  if (!recette_id || !nom) {
    return { error: "Nom requis." };
  }

  const supabase = createAdminClient();
  // `ordre` calculé côté serveur (pas confié au client, cf.
  // `ingredients.length` côté formulaire) : deux ajouts rapides avant que les
  // props du parent ne se rafraîchissent envoyaient sinon le même `ordre`
  // pour deux lignes différentes (CLICK-PATH-205).
  const { data: dernier } = await supabase
    .from("recette_ingredients_libres")
    .select("ordre")
    .eq("recette_id", recette_id)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordre = (dernier?.ordre ?? -1) + 1;

  const { error } = await supabase
    .from("recette_ingredients_libres")
    .insert({ recette_id, nom, quantite: quantiteRaw || null, ordre });

  if (error) return { error: error.message };

  revalidateRecette(recette_id);
  return { error: null };
}

// Contrat T1 (lib/actions/result.ts) : l'échec est retourné, jamais levé.
export async function updateIngredientLibre(
  id: string,
  recette_id: string,
  nom: string,
  quantite: string
): Promise<ActionResult> {
  const trimmedNom = nom.trim();
  if (!trimmedNom) {
    return fail("Le nom est requis.");
  }

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recette_ingredients_libres")
    .update({ nom: trimmedNom, quantite: quantite.trim() || null }, { count: "exact" })
    .eq("id", id);

  if (error) {
    console.error("updateIngredientLibre : échec de la mise à jour", error);
    return fail("La modification a échoué. Réessaie.");
  }
  if (!count) {
    return fail("Modification impossible : cet ingrédient est introuvable.");
  }

  revalidateRecette(recette_id);
  return ok();
}

export async function removeIngredientLibre(id: string, recette_id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recette_ingredients_libres")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    console.error("removeIngredientLibre : échec de la suppression", error);
    return fail("La suppression a échoué. Réessaie.");
  }
  if (!count) {
    return fail("Suppression impossible : cet ingrédient est introuvable.");
  }

  revalidateRecette(recette_id);
  return ok();
}

