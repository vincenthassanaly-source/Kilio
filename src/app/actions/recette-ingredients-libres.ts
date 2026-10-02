"use server";

import { revalidatePath, updateTag } from "next/cache";
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

export async function updateIngredientLibre(
  id: string,
  recette_id: string,
  nom: string,
  quantite: string
) {
  const trimmedNom = nom.trim();
  if (!trimmedNom) {
    throw new Error("Le nom est requis.");
  }

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recette_ingredients_libres")
    .update({ nom: trimmedNom, quantite: quantite.trim() || null }, { count: "exact" })
    .eq("id", id);

  if (error) throw new Error(error.message);
  if (!count) {
    throw new Error("Modification impossible : cet ingrédient est introuvable.");
  }

  revalidateRecette(recette_id);
}

export async function removeIngredientLibre(id: string, recette_id: string) {
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recette_ingredients_libres")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) throw new Error(error.message);
  if (!count) {
    throw new Error("Suppression impossible : cet ingrédient est introuvable.");
  }

  revalidateRecette(recette_id);
}

