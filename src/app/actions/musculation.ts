"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { EntrainementDetail, EntrainementResume } from "@/lib/musculation/historique";
import { validerNomDossier, validerRoutine, type RoutineDetail, type RoutineEntree } from "@/lib/musculation/routines";
import { validerPayload, type EntrainementPayload, type SeriePrecedente } from "@/lib/musculation/seance";
import {
  creerDossier as creerDossierDb,
  dernieresSeries,
  enregistrerEntrainement as enregistrerEntrainementDb,
  enregistrerRoutine as enregistrerRoutineDb,
  lireEntrainement,
  lireRoutine,
  listerEntrainements,
  listerExercices,
  listerRoutines,
  renommerDossier as renommerDossierDb,
  supprimerDossier as supprimerDossierDb,
  supprimerEntrainement as supprimerEntrainementDb,
  supprimerRoutine as supprimerRoutineDb,
  type ExerciceCatalogue,
  type RoutinesEtDossiers,
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

// --- Routines -------------------------------------------------------------

export async function getRoutines(): Promise<RoutinesEtDossiers> {
  return listerRoutines(createAdminClient());
}

/** Routine complète, ou `null` si l'identifiant est invalide ou la routine introuvable. */
export async function getRoutine(id: string): Promise<RoutineDetail | null> {
  if (typeof id !== "string" || !estUuid(id)) return null;
  return lireRoutine(createAdminClient(), id);
}

export async function enregistrerRoutine(entree: RoutineEntree): Promise<ActionResult<{ id: string }>> {
  const erreur = validerRoutine(entree);
  if (erreur) return fail(erreur);

  const resultat = await enregistrerRoutineDb(createAdminClient(), entree);
  if (resultat.error || !resultat.id) return fail(resultat.error ?? "La routine n'a pas pu être enregistrée.");

  revalidatePath("/musculation");
  return ok({ id: resultat.id });
}

export async function supprimerRoutine(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !estUuid(id)) return fail("Routine introuvable.");
  const resultat = await supprimerRoutineDb(createAdminClient(), id);
  if (resultat.error) return fail(resultat.error);

  revalidatePath("/musculation");
  return ok();
}

export async function creerDossier(nom: string): Promise<ActionResult<{ id: string }>> {
  const erreur = validerNomDossier(nom);
  if (erreur) return fail(erreur);

  const resultat = await creerDossierDb(createAdminClient(), nom);
  if (resultat.error || !resultat.id) return fail(resultat.error ?? "Le dossier n'a pas pu être créé.");

  revalidatePath("/musculation");
  return ok({ id: resultat.id });
}

export async function renommerDossier(id: string, nom: string): Promise<ActionResult> {
  if (typeof id !== "string" || !estUuid(id)) return fail("Dossier introuvable.");
  const erreur = validerNomDossier(nom);
  if (erreur) return fail(erreur);

  const resultat = await renommerDossierDb(createAdminClient(), id, nom);
  if (resultat.error) return fail(resultat.error);

  revalidatePath("/musculation");
  return ok();
}

export async function supprimerDossier(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !estUuid(id)) return fail("Dossier introuvable.");
  const resultat = await supprimerDossierDb(createAdminClient(), id);
  if (resultat.error) return fail(resultat.error);

  revalidatePath("/musculation");
  return ok();
}

// --- Historique -----------------------------------------------------------

/** Séances terminées, de la plus récente à la plus ancienne (`limite` : 1 à 200). */
export async function getEntrainements(limite: number): Promise<EntrainementResume[]> {
  const n = Number.isInteger(limite) ? limite : 30;
  return listerEntrainements(createAdminClient(), n);
}

/** Séance complète, ou `null` si l'identifiant est invalide ou la séance introuvable. */
export async function getEntrainement(id: string): Promise<EntrainementDetail | null> {
  if (typeof id !== "string" || !estUuid(id)) return null;
  return lireEntrainement(createAdminClient(), id);
}

export async function supprimerEntrainement(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !estUuid(id)) return fail("Séance introuvable.");
  const resultat = await supprimerEntrainementDb(createAdminClient(), id);
  if (resultat.error) return fail(resultat.error);

  revalidatePath("/musculation");
  return ok();
}
