"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

export async function getPlanningTravail(): Promise<Tables<"horaires_travail_creneaux">[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("horaires_travail_creneaux")
    .select("*")
    .order("jour_semaine", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPlanningTravailExceptions(): Promise<
  Tables<"horaires_travail_exceptions">[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("horaires_travail_exceptions")
    .select("*")
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

