"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { Tables } from "@/lib/supabase/types";

// Table singleton : une seule ligne, id fixé à 1 (voir
// migration-reglages-saisie-ia-2026-10-02.sql).
const REGLAGES_ID = 1;

export type ReglagesSaisieIA = Tables<"reglages_saisie_ia">;

/**
 * Réglages de « Ajouter avec l'IA ». Jamais bloquant : si la table manque
 * (migration pas encore appliquée) ou si la lecture échoue, on rend « pas de
 * réglage » et la saisie retombe sur la liste « Tâches ».
 */
export async function getReglagesSaisieIA(): Promise<ReglagesSaisieIA | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reglages_saisie_ia")
    .select("*")
    .eq("id", REGLAGES_ID)
    .maybeSingle();

  if (error) {
    console.error("[saisie-ia] Lecture des réglages impossible.", error.message);
    return null;
  }
  return data;
}

// Contrat `ActionResult` (T1). `null` = pas de liste choisie.
export async function updateListeSaisieIA(listeId: string | null): Promise<ActionResult> {
  const supabase = createAdminClient();

  if (listeId !== null) {
    const { data, error } = await supabase.from("listes_taches").select("id").eq("id", listeId).maybeSingle();
    if (error || !data) return fail("Cette liste n'existe plus. Choisis-en une autre.");
  }

  const { error } = await supabase
    .from("reglages_saisie_ia")
    .upsert({ id: REGLAGES_ID, liste_taches_id: listeId });

  if (error) return fail("Le réglage n'a pas pu être enregistré. Réessaie.");

  revalidatePath("/reglages");
  return ok();
}
