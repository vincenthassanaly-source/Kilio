"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { createAdminClient } from "@/lib/supabase/admin";

export type EtapeFormState = { error: string | null };

function revalidateRecette(recette_id: string) {
  revalidatePath("/nutrition/recettes");
  revalidatePath(`/nutrition/recettes/${recette_id}`);
}

export async function addEtape(
  _prevState: EtapeFormState,
  formData: FormData
): Promise<EtapeFormState> {
  const recette_id = String(formData.get("recette_id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  const consigne = String(formData.get("consigne") ?? "").trim();
  const astuce = String(formData.get("astuce") ?? "").trim();

  if (!recette_id || !consigne) {
    return { error: "La consigne est requise." };
  }

  const supabase = createAdminClient();
  // `ordre` calculé côté serveur, pas confié au client (voir
  // recette-ingredients-libres.ts, même fix, CLICK-PATH-205).
  const { data: derniere } = await supabase
    .from("recette_etapes")
    .select("ordre")
    .eq("recette_id", recette_id)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordre = (derniere?.ordre ?? -1) + 1;

  const { error } = await supabase.from("recette_etapes").insert({
    recette_id,
    titre: titre || null,
    consigne,
    astuce: astuce || null,
    ordre,
  });

  if (error) return { error: error.message };

  revalidateRecette(recette_id);
  return { error: null };
}

// Contrat T1 (lib/actions/result.ts) : l'échec est retourné, jamais levé.
export async function updateEtape(
  id: string,
  recette_id: string,
  titre: string,
  consigne: string,
  astuce: string
): Promise<ActionResult> {
  const trimmedConsigne = consigne.trim();
  if (!trimmedConsigne) {
    return fail("La consigne est requise.");
  }

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recette_etapes")
    .update(
      {
        titre: titre.trim() || null,
        consigne: trimmedConsigne,
        astuce: astuce.trim() || null,
      },
      { count: "exact" }
    )
    .eq("id", id);

  if (error) {
    console.error("updateEtape : échec de la mise à jour", error);
    return fail("La modification a échoué. Réessaie.");
  }
  if (!count) {
    return fail("Modification impossible : cette étape est introuvable.");
  }

  revalidateRecette(recette_id);
  return ok();
}

export async function removeEtape(id: string, recette_id: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("recette_etapes")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    console.error("removeEtape : échec de la suppression", error);
    return fail("La suppression a échoué. Réessaie.");
  }
  if (!count) {
    return fail("Suppression impossible : cette étape est introuvable.");
  }

  revalidateRecette(recette_id);
  return ok();
}
