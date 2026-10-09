"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  calculerHeureFin,
  etendreOccurrences,
  HEURE_DEBUT_JOURNEE_ENTIERE,
  HEURE_FIN_JOURNEE_ENTIERE,
  HEURE_REGEX,
  type FrequenceEvenement,
} from "@/lib/evenements/compute";
import { estUuid } from "@/lib/uuid";
import type { Tables } from "@/lib/supabase/types";

// `dateOrigine` : date de départ de la série pour une occurrence d'un événement
// récurrent (`date` y est la date de l'occurrence affichée).
export type Evenement = Tables<"evenements"> & { dateOrigine?: string };

const RAPPELS_EVENEMENT = [5, 15, 30, 60, 1440] as const;

export type EvenementInput = {
  titre: string;
  date: string;
  heure: string;
  dureeMinutes: number;
  notes?: string | null;
  toute_la_journee?: boolean;
  rappelMinutes?: number | null;
  recurrenceFrequence?: FrequenceEvenement | null;
  recurrenceFin?: string | null;
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

type EvenementEcrit = Omit<Tables<"evenements">, "id" | "created_at" | "updated_at">;

function valider(input: EvenementInput): { ok: true; value: EvenementEcrit } | { ok: false; error: string } {
  const titre = input.titre.trim();
  if (!titre) return { ok: false, error: "Le titre est requis." };
  if (!DATE_REGEX.test(input.date)) return { ok: false, error: "Date invalide." };
  const journeeEntiere = input.toute_la_journee === true;
  let heure = HEURE_DEBUT_JOURNEE_ENTIERE;
  let heureFin = HEURE_FIN_JOURNEE_ENTIERE;
  if (!journeeEntiere) {
    if (!HEURE_REGEX.test(input.heure)) return { ok: false, error: "Heure invalide (format HH:MM)." };
    const fin = calculerHeureFin(input.heure, input.dureeMinutes);
    if (!fin) return { ok: false, error: "La durée doit tenir dans la journée." };
    heure = input.heure;
    heureFin = fin;
  }

  const rappel = input.rappelMinutes ?? null;
  if (rappel !== null && !(RAPPELS_EVENEMENT as readonly number[]).includes(rappel)) {
    return { ok: false, error: "Rappel invalide." };
  }
  // Journée entière : seul « la veille » a un sens (cf. rappels des tâches).
  if (rappel !== null && journeeEntiere && rappel !== 1440) {
    return { ok: false, error: "Une journée entière ne peut être rappelée que la veille." };
  }

  const frequence = input.recurrenceFrequence ?? null;
  const finRecurrence = frequence ? input.recurrenceFin || null : null;
  if (finRecurrence && (!DATE_REGEX.test(finRecurrence) || finRecurrence < input.date)) {
    return { ok: false, error: "La fin de la récurrence doit être après la date de l'événement." };
  }

  return {
    ok: true,
    value: {
      titre,
      date: input.date,
      heure,
      heure_fin: heureFin,
      notes: input.notes?.trim() || null,
      toute_la_journee: journeeEntiere,
      rappel_minutes: rappel,
      rappel_occurrence_envoyee: null,
      recurrence_frequence: frequence,
      recurrence_fin: finRecurrence,
    },
  };
}

/** Événements entre deux dates incluses (AAAA-MM-JJ), triés par date puis heure. */
export async function getEvenements(debut: string, fin: string): Promise<Evenement[]> {
  if (!DATE_REGEX.test(debut) || !DATE_REGEX.test(fin)) return [];
  const supabase = createAdminClient();
  // Événements simples dans la plage + séries commencées avant la fin de la
  // plage (dépliées en occurrences ci-dessous).
  const { data, error } = await supabase
    .from("evenements")
    .select("*")
    .or(
      `and(recurrence_frequence.is.null,date.gte.${debut},date.lte.${fin}),and(recurrence_frequence.not.is.null,date.lte.${fin})`
    )
    .order("date", { ascending: true })
    .order("heure", { ascending: true });

  if (error) {
    if (error.code && CODES_TABLE_ABSENTE.includes(error.code)) return [];
    throw new Error(error.message);
  }
  return etendreOccurrences(data ?? [], debut, fin).sort(
    (a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure)
  );
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
