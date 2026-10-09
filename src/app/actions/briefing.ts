"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { Tables } from "@/lib/supabase/types";

// Table singleton (id fixé à 1), sur le modèle de reglages_nettoyage.
const REGLAGES_ID = 1;

export type ReglagesBriefing = Tables<"reglages_briefing">;

const HEURE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function getReglagesBriefing(): Promise<ReglagesBriefing> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("reglages_briefing").select("*").eq("id", REGLAGES_ID).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateReglagesBriefing(actif: boolean, heure: string): Promise<ActionResult> {
  if (!HEURE_REGEX.test(heure)) return fail("Heure invalide (format HH:MM).");

  const supabase = createAdminClient();
  // Changer l'heure ou réactiver le briefing ne rejoue pas celui d'aujourd'hui
  // s'il est déjà parti : `dernier_envoi` reste tel quel.
  const { error } = await supabase.from("reglages_briefing").update({ actif, heure }).eq("id", REGLAGES_ID);
  if (error) return fail("Le réglage n'a pas pu être enregistré. Réessaie.");

  revalidatePath("/reglages");
  return ok();
}

export async function updateReglagesRevue(actif: boolean, jour: number, heure: string): Promise<ActionResult> {
  if (!Number.isInteger(jour) || jour < 0 || jour > 6) return fail("Jour invalide.");
  if (!HEURE_REGEX.test(heure)) return fail("Heure invalide (format HH:MM).");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reglages_briefing")
    .update({ revue_actif: actif, revue_jour: jour, revue_heure: heure })
    .eq("id", REGLAGES_ID);
  if (error) return fail("Le réglage n'a pas pu être enregistré. Réessaie.");

  revalidatePath("/reglages");
  return ok();
}
