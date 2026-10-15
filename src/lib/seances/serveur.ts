// Accès base des séances de la semaine (Push / Pull / Legs), partagé par les
// Server Actions. Module neutre (ni "use server" ni "use client") : il reçoit le
// client admin en paramètre, ce qui le rend testable avec le faux Supabase.
// Rien n'est stocké ici : « faite cette semaine » se déduit des entraînements.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { composerSemaine, estTypeSeance, semaineDe, type RoutineSemaine, type SemaineSeances } from "./compute";

type Client = SupabaseClient<Database>;

/** Routines typées et entraînements de la semaine du jour `today` (lundi → dimanche). */
export async function lireSemaine(supabase: Client, today: string): Promise<SemaineSeances> {
  const { debut, fin } = semaineDe(today);
  const [routines, exercices, entrainements] = await Promise.all([
    supabase.from("routines").select("id, nom, type_seance").not("type_seance", "is", null).order("ordre").order("nom"),
    supabase.from("routine_exercices").select("routine_id"),
    supabase.from("entrainements").select("routine_id, type_seance, date").gte("date", debut).lte("date", fin),
  ]);
  const erreur = routines.error ?? exercices.error ?? entrainements.error;
  if (erreur) throw new Error(erreur.message);

  const nombre = new Map<string, number>();
  for (const l of exercices.data ?? []) nombre.set(l.routine_id, (nombre.get(l.routine_id) ?? 0) + 1);

  const typees: RoutineSemaine[] = [];
  for (const r of routines.data ?? []) {
    if (r.type_seance && estTypeSeance(r.type_seance)) {
      typees.push({ id: r.id, nom: r.nom, type: r.type_seance, nbExercices: nombre.get(r.id) ?? 0 });
    }
  }
  return composerSemaine(typees, entrainements.data ?? [], today);
}
