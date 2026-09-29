import { revalidatePath } from "next/cache";
import { normaliserTexte } from "@/lib/saisie-ia/outils";
import type { IssueCreation } from "@/lib/saisie-ia/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTache } from "@/app/actions/taches";
import type { TacheACreer } from "./saisie-naturelle";

// Écritures du module Tâches de « Ajouter avec l'IA » (côté serveur, appelées
// par les actions de saisie et jamais depuis le client).

type Supabase = ReturnType<typeof createAdminClient>;

// Retrouve une liste par son nom (sans accents ni casse) ou la crée en fin
// de navigation. `cache` évite de créer deux fois la même liste quand
// plusieurs tâches d'un même lot la citent.
export async function assurerListe(supabase: Supabase, nom: string, cache: Map<string, string>): Promise<string> {
  const cle = normaliserTexte(nom);
  const enCache = cache.get(cle);
  if (enCache) return enCache;

  const { data: existantes, error } = await supabase.from("listes_taches").select("id, nom, ordre");
  if (error) throw new Error(error.message);

  const trouvee = (existantes ?? []).find((l) => normaliserTexte(l.nom) === cle);
  if (trouvee) {
    cache.set(cle, trouvee.id);
    return trouvee.id;
  }

  const ordre = (existantes ?? []).reduce((max, l) => Math.max(max, l.ordre), -1) + 1;
  const { data, error: erreurInsertion } = await supabase
    .from("listes_taches")
    .insert({ nom: nom.trim().slice(0, 40), ordre })
    .select("id")
    .single();
  if (erreurInsertion) throw new Error(erreurInsertion.message);

  cache.set(cle, data.id);
  revalidatePath("/taches");
  revalidatePath("/taches/listes");
  return data.id;
}

// Première liste (celle que le formulaire présélectionne) ; « Tâches » est
// créée quand l'app n'en a encore aucune.
async function premiereListe(supabase: Supabase, cache: Map<string, string>): Promise<string> {
  const { data, error } = await supabase.from("listes_taches").select("id").order("ordre", { ascending: true }).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? (await assurerListe(supabase, "Tâches", cache));
}

// Crée les tâches validées, une à une (l'ordre dans la liste dépend de la
// précédente). Un échec n'arrête pas le lot : chaque tâche a son résultat,
// l'UI garde celles qui ont échoué dans l'aperçu.
export async function creerTaches(taches: TacheACreer[]): Promise<IssueCreation[]> {
  const supabase = createAdminClient();
  const cacheListes = new Map<string, string>();
  const resultats: IssueCreation[] = [];

  for (const t of taches) {
    try {
      // Sans liste (tâche issue d'un changement de type dans l'aperçu) : la
      // première, comme le formulaire manuel.
      const listeId = t.nouvelleListe
        ? await assurerListe(supabase, t.nouvelleListe, cacheListes)
        : (t.listeId ?? (await premiereListe(supabase, cacheListes)));
      if (!listeId) {
        resultats.push({ ok: false, message: "Liste introuvable." });
        continue;
      }

      const formData = new FormData();
      formData.set("titre", String(t.titre ?? ""));
      formData.set("liste_id", listeId);
      formData.set("echeance", t.echeance ?? "");
      formData.set("heure", t.heure ?? "");
      formData.set("heure_fin", t.heure_fin ?? "");
      formData.set("priorite", String(t.priorite ?? "aucune"));
      formData.set("recurrence_frequence", t.recurrence_frequence ?? "");
      formData.set("recurrence_fin", t.recurrence_fin ?? "");
      formData.set("rappel_minutes", t.rappel_minutes === null ? "" : String(t.rappel_minutes));
      if (t.toute_la_journee) formData.set("toute_la_journee", "on");
      for (const id of Array.isArray(t.tagIds) ? t.tagIds : []) formData.append("tag_ids", String(id));
      // Virgules retirées : createTache découpe `nouveaux_tags` sur ce signe.
      formData.set(
        "nouveaux_tags",
        (Array.isArray(t.nouveauxTags) ? t.nouveauxTags : []).map((n) => String(n).replace(/,/g, " ")).join(",")
      );

      const etat = await createTache({ error: null }, formData);
      if (etat.error || !etat.id) {
        resultats.push({ ok: false, message: etat.error ?? "La tâche n'a pas pu être créée." });
      } else {
        resultats.push({
          ok: true,
          ...(etat.avertissement ? { avertissement: etat.avertissement } : {}),
        });
      }
    } catch (err) {
      console.error("[saisie-ia] Création d'une tâche en échec.", err);
      resultats.push({ ok: false, message: "La tâche n'a pas pu être créée. Réessaie." });
    }
  }

  return resultats;
}
