import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Nombre d'exercices du catalogue. Retourne 0 si la table est absente ou
 * inaccessible (migration pas encore appliquée) : l'écran reste alors sur son
 * état vide plutôt que de planter.
 */
export async function compterExercices(): Promise<number> {
  const { count, error } = await createAdminClient().from("exercices").select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}
