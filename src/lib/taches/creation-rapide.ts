import { createAdminClient } from "@/lib/supabase/admin";

type Client = ReturnType<typeof createAdminClient>;

export type ResultatCreation = { ok: true; id: string } | { ok: false; error: string };

/**
 * Crée une tâche minimale (titre, notes, lien vers une note) dans la première
 * liste, en fin de liste. Sert à transformer une capture d'inbox, une note ou
 * un élément de checklist en tâche sans passer par le formulaire complet.
 * Le client est passé en paramètre (même client que l'action appelante).
 * L'appelant revalide les caches (tag des tâches, chemins).
 */
export async function creerTacheRapide(
  supabase: Client,
  input: { titre: string; notes?: string | null; note_id?: string | null }
): Promise<ResultatCreation> {
  const titre = input.titre.trim();
  if (!titre) return { ok: false, error: "Le titre est requis." };

  const { data: liste, error: listeError } = await supabase
    .from("listes_taches")
    .select("id")
    .order("ordre", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (listeError) return { ok: false, error: listeError.message };
  if (!liste) return { ok: false, error: "Crée d'abord une liste de tâches." };

  const { data: derniere } = await supabase
    .from("taches")
    .select("ordre")
    .eq("liste_id", liste.id)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("taches")
    .insert({
      titre,
      notes: input.notes?.trim() || null,
      note_id: input.note_id ?? null,
      liste_id: liste.id,
      ordre: (derniere?.ordre ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}
