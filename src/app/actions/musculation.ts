"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { validerPayload, type EntrainementPayload, type SeriePrecedente } from "@/lib/musculation/seance";
import {
  dernieresSeries,
  enregistrerEntrainement as enregistrerEntrainementDb,
  listerExercices,
  type ExerciceCatalogue,
} from "@/lib/musculation/serveur";
import { estUuid } from "@/lib/uuid";

export async function getExercices(): Promise<ExerciceCatalogue[]> {
  return listerExercices(createAdminClient());
}

/** Séries de la dernière séance de chaque exercice (repère « Précédent »). */
export async function getDernieresSeries(exerciceIds: string[]): Promise<Record<string, SeriePrecedente[]>> {
  if (!Array.isArray(exerciceIds)) return {};
  return dernieresSeries(createAdminClient(), exerciceIds.filter((id) => typeof id === "string" && estUuid(id)));
}

/** Séance planifiée à démarrer : son type nomme la séance. `null` si introuvable. */
export async function getSeancePlanifiee(id: string): Promise<{ id: string; type: string } | null> {
  if (typeof id !== "string" || !estUuid(id)) return null;
  const { data } = await createAdminClient().from("seances").select("id, type").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function enregistrerEntrainement(payload: EntrainementPayload): Promise<ActionResult> {
  const erreur = validerPayload(payload);
  if (erreur) return fail(erreur);

  const resultat = await enregistrerEntrainementDb(createAdminClient(), payload);
  if (resultat.error) return fail(resultat.error);

  revalidatePath("/musculation");
  revalidatePath("/aujourdhui");
  revalidatePath("/nutrition/journal");
  revalidatePath("/nutrition/bilan");
  revalidatePath("/");
  return ok();
}
