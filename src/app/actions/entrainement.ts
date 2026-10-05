"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type EntrainementResult = { error: string | null };

/**
 * Marque une date comme jour d'entraînement (`entraine: true`) ou de repos.
 * Utilisable sur une date passée : le Bilan et le suivi des objectifs relisent
 * le statut par date.
 */
export async function setJourEntrainement(date: string, entraine: boolean): Promise<EntrainementResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("jours_entrainement")
    .upsert({ date, entraine, updated_at: new Date().toISOString() }, { onConflict: "date" });
  if (error) {
    console.error("setJourEntrainement: échec de l'upsert Supabase", error);
    return { error: "Impossible d'enregistrer le statut du jour. Réessaie dans un instant." };
  }

  revalidatePath("/nutrition/journal");
  revalidatePath("/nutrition/bilan");
  revalidatePath("/");
  revalidatePath("/aujourdhui");
  return { error: null };
}
