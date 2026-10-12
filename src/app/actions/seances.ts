"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SemaineSeances } from "@/lib/seances/compute";
import { lireSemaine } from "@/lib/seances/serveur";

/**
 * Séances de la semaine en cours (Push / Pull / Legs, pastilles A/B/C) avec ce
 * qui est déjà fait depuis lundi. Lecture seule : appelée à l'ouverture de
 * l'écran Aujourd'hui, donc sans revalidatePath.
 */
export async function getSemaineSeances(today: string): Promise<SemaineSeances> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("Date invalide.");
  return lireSemaine(createAdminClient(), today);
}
