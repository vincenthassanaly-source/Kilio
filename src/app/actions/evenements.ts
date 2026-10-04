"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { calculerHeureFin, HEURE_REGEX } from "@/lib/evenements/compute";
import { estUuid } from "@/lib/uuid";
import type { Tables } from "@/lib/supabase/types";

export type Evenement = Tables<"evenements">;

export type EvenementInput = {
  titre: string;
  date: string;
  heure: string;
  dureeMinutes: number;
  notes?: string | null;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Tant que la migration `evenements` n'est pas appliquée, la table n'existe
// pas : les écrans qui listent des événements s'affichent sans, plutôt que de
// tomber en erreur (42P01 : Postgres, PGRST205 : PostgREST).
const CODES_TABLE_ABSENTE = ["42P01", "PGRST205"];

function revalidateEvenements() {
  revalidatePath("/aujourdhui");
  revalidatePath("/agenda");
}

function valider(input: EvenementInput): { ok: true; value: Omit<Evenement, "id" | "created_at" | "updated_at"> } | { ok: false; error: string } {
  const titre = input.titre.trim();
  if (!titre) return { ok: false, error: "Le titre est requis." };
  if (!DATE_REGEX.test(input.date)) return { ok: false, error: "Date invalide." };
  if (!HEURE_REGEX.test(input.heure)) return { ok: false, error: "Heure invalide (format HH:MM)." };
  const heureFin = calculerHeureFin(input.heure, input.dureeMinutes);
  if (!heureFin) return { ok: false, error: "La durée doit tenir dans la journée." };
  return {
    ok: true,
    value: { titre, date: input.date, heure: input.heure, heure_fin: heureFin, notes: input.notes?.trim() || null },
  };
}

/** Événements entre deux dates incluses (AAAA-MM-JJ), triés par date puis heure. */
export async function getEvenements(debut: string, fin: string): Promise<Evenement[]> {
  if (!DATE_REGEX.test(debut) || !DATE_REGEX.test(fin)) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("evenements")
    .select("*")
    .gte("date", debut)
    .lte("date", fin)
    .order("date", { ascending: true })
    .order("heure", { ascending: true });

  if (error) {
    if (error.code && CODES_TABLE_ABSENTE.includes(error.code)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function createEvenement(input: EvenementInput): Promise<ActionResult<{ id: string }>> {
  const parsed = valider(input);
  if (!parsed.ok) return fail(parsed.error);

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("evenements").insert(parsed.value).select("id").single();
  if (error) return fail(error.message);

  revalidateEvenements();
  return ok({ id: data.id });
}

export async function updateEvenement(id: string, input: EvenementInput): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Événement introuvable.");
  const parsed = valider(input);
  if (!parsed.ok) return fail(parsed.error);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("evenements")
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidateEvenements();
  return ok();
}

export async function deleteEvenement(id: string): Promise<ActionResult> {
  if (!estUuid(id)) return fail("Événement introuvable.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("evenements").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidateEvenements();
  return ok();
}
