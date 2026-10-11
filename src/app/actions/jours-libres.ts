"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { aujourdhuiParis } from "@/lib/date/paris";
import { erreurPoseJourLibre, peutRetirerJourLibre, plageJoursLibres } from "@/lib/nutrition/libres";
import { semaineDe } from "@/lib/seances/compute";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Dates (YYYY-MM-DD) marquées « jour libre » entre `debut` et `fin` incluses :
// la limite kcal est suspendue ces jours-là (pas d'alerte, jour neutre au Bilan).
export async function getJoursLibres(debut: string, fin: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("jours_libres")
    .select("date")
    .gte("date", debut)
    .lte("date", fin)
    .order("date");
  if (error) throw new Error(error.message);
  return (data ?? []).map((ligne) => ligne.date);
}

/** Jours libres utiles à l'écran Aujourd'hui (cf. plageJoursLibres). */
export async function getJoursLibresAutour(today: string): Promise<string[]> {
  if (!DATE_REGEX.test(today)) throw new Error("Date invalide.");
  const { debut, fin } = plageJoursLibres(today);
  return getJoursLibres(debut, fin);
}

function revalider() {
  revalidatePath("/aujourdhui");
  revalidatePath("/nutrition/journal");
  revalidatePath("/nutrition/bilan");
  revalidatePath("/");
}

/** Pose un jour libre (aujourd'hui ou demain, 2 jetons par semaine). */
export async function poserJourLibre(date: string): Promise<ActionResult> {
  if (!DATE_REGEX.test(date)) return fail("Date invalide.");

  const { debut, fin } = semaineDe(date);
  let existants: string[];
  try {
    existants = await getJoursLibres(debut, fin);
  } catch {
    return fail("Le jour libre n'a pas pu être posé. Réessaie.");
  }
  const refus = erreurPoseJourLibre(date, aujourdhuiParis(), existants);
  if (refus) return fail(refus);

  const { error } = await createAdminClient().from("jours_libres").insert({ date });
  if (error) return fail("Le jour libre n'a pas pu être posé. Réessaie.");

  revalider();
  return ok();
}

/** Retire un jour libre (tant qu'il n'est pas passé) : le jeton est rendu. */
export async function retirerJourLibre(date: string): Promise<ActionResult> {
  if (!DATE_REGEX.test(date)) return fail("Date invalide.");
  if (!peutRetirerJourLibre(date, aujourdhuiParis())) return fail("Un jour libre passé ne peut plus être retiré.");

  const { error } = await createAdminClient().from("jours_libres").delete().eq("date", date);
  if (error) return fail("Le jour libre n'a pas pu être retiré. Réessaie.");

  revalider();
  return ok();
}
