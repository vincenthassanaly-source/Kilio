"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECETTES_TAG } from "@/lib/nutrition/tags";
import type { Enums } from "@/lib/supabase/types";

export type IngredientFormState = { error: string | null };

export async function addIngredient(
  _prevState: IngredientFormState,
  formData: FormData
): Promise<IngredientFormState> {
  const recette_id = String(formData.get("recette_id") ?? "");
  const aliment_id = String(formData.get("aliment_id") ?? "");
  const unite = String(formData.get("unite") ?? "") as Enums<"unite_mesure">;
  const quantite = Number(formData.get("quantite"));

  if (!recette_id || !aliment_id) {
    return { error: "Aliment requis." };
  }
  if (!Number.isFinite(quantite) || quantite <= 0) {
    return { error: "La quantité doit être un nombre positif." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("recette_ingredients")
    .insert({ recette_id, aliment_id, quantite, unite });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "Cet aliment est déjà dans la recette : modifie sa quantité au lieu de le rajouter.",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/nutrition/recettes/${recette_id}`);
  updateTag(RECETTES_TAG);
  return { error: null };
}

// Contrat T1 (lib/actions/result.ts) : l'échec est retourné, jamais levé. Next
// masque en production le message d'une exception de Server Action, et le
// composant afficherait alors une erreur React illisible (#441).
export async function updateIngredient(
  id: string,
  recette_id: string,
  quantite: number
): Promise<ActionResult> {
  if (!Number.isFinite(quantite) || quantite <= 0) {
    return fail("La quantité doit être un nombre positif.");
  }

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recette_ingredients")
    .update({ quantite }, { count: "exact" })
    .eq("id", id);

  if (error) {
    console.error("updateIngredient : échec de la mise à jour", error);
    return fail("La modification a échoué. Réessaie.");
  }
  if (!count) {
    return fail("Modification impossible : cette recette est partagée et non modifiable.");
  }

  revalidatePath(`/nutrition/recettes/${recette_id}`);
  updateTag(RECETTES_TAG);
  return ok();
}

export async function removeIngredient(id: string, recette_id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recette_ingredients")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    console.error("removeIngredient : échec de la suppression", error);
    return fail("La suppression a échoué. Réessaie.");
  }
  if (!count) {
    return fail("Suppression impossible : cette recette est partagée et non modifiable.");
  }

  revalidatePath(`/nutrition/recettes/${recette_id}`);
  updateTag(RECETTES_TAG);
  return ok();
}
