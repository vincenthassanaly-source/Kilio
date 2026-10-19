"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

// Une seule séance en direct à la fois (app mono-utilisateur) : une seule ligne,
// toujours la même, remplacée à chaque nouveau repos. Le cron pg_cron (voir
// scripts/migration-rappel-repos-2026-10-19.sql) déclenche l'Edge Function
// envoyer-rappel-repos, qui envoie le push à l'échéance.
const ID_RAPPEL = "courant";
const URL_SEANCE = "/musculation/seance";
// Un repos ne dépasse pas 30 min (ajusterReposExercice) : au-delà, la valeur est aberrante.
const HORIZON_MAX_MS = 2 * 60 * 60 * 1000;

export async function programmerRappelRepos(entree: { finA: string; titre: string; corps: string }): Promise<ActionResult> {
  const fin = new Date(entree.finA).getTime();
  if (!Number.isFinite(fin)) return fail("Heure de fin de repos invalide.");
  const maintenant = Date.now();
  // Échéance déjà dépassée de plus d'une minute : le repos est fini, rien à annoncer.
  if (fin < maintenant - 60_000 || fin > maintenant + HORIZON_MAX_MS) return fail("Heure de fin de repos hors limites.");

  const { error } = await createAdminClient()
    .from("rappels_repos")
    .upsert({
      id: ID_RAPPEL,
      fin_a: new Date(fin).toISOString(),
      titre: entree.titre.slice(0, 80),
      corps: entree.corps.slice(0, 160),
      url: URL_SEANCE,
      envoye: false,
      updated_at: new Date().toISOString(),
    });
  if (error) return fail("Le rappel de fin de repos n'a pas pu être programmé.");
  return ok();
}

export async function annulerRappelRepos(): Promise<ActionResult> {
  const { error } = await createAdminClient().from("rappels_repos").delete().eq("id", ID_RAPPEL);
  if (error) return fail("Le rappel de fin de repos n'a pas pu être annulé.");
  return ok();
}
