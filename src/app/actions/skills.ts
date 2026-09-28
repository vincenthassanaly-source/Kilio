"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";
import { CATEGORIE_LABELS, ORDRE_CATEGORIES, type CategorieSkill } from "@/lib/skills/constants";
import { suggererSkillsParGemini, suggererSkillsParMotsCles } from "@/lib/skills/matching";

export type Skill = Tables<"skills_catalogue">;

export type CategorieAvecCompte = { categorie: CategorieSkill; label: string; compte: number };

function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, (c) => `\\${c}`);
}

// Vue par défaut de l'écran (pas de recherche active) : une tuile par
// catégorie avec son nombre de fiches, pour donner une carte mentale du
// territoire plutôt qu'une liste plate de ~25 skills.
export async function listerCategoriesAvecCompte(): Promise<CategorieAvecCompte[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("skills_catalogue").select("categorie");

  if (error) throw new Error(error.message);

  const comptes = new Map<CategorieSkill, number>();
  for (const row of data ?? []) {
    comptes.set(row.categorie, (comptes.get(row.categorie) ?? 0) + 1);
  }

  return ORDRE_CATEGORIES.filter((categorie) => (comptes.get(categorie) ?? 0) > 0).map((categorie) => ({
    categorie,
    label: CATEGORIE_LABELS[categorie],
    compte: comptes.get(categorie) ?? 0,
  }));
}

export async function listerSkillsParCategorie(categorie: CategorieSkill): Promise<Skill[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("skills_catalogue")
    .select("*")
    .eq("categorie", categorie)
    .order("ordre", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Recherche live de la barre du haut : filtre par mot-clé sur le nom, la
// description et les exemples d'usage — pas de recherche floue (pg_trgm)
// en V1, repoussée volontairement (voir brief /impeccable shape) tant que
// le format des ~25 fiches curées n'est pas validé à l'usage.
export async function rechercherSkills(query: string): Promise<Skill[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = createAdminClient();
  const like = `%${escapeIlike(q)}%`;

  const { data, error } = await supabase
    .from("skills_catalogue")
    .select("*")
    .or(`nom.ilike.${like},description.ilike.${like},exemples.cs.{${q}}`)
    .order("categorie", { ascending: true })
    .order("ordre", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Mode « je ne sais pas quoi choisir » : matching sémantique via Gemini
// (gemini-2.5-flash-lite, voir lib/skills/matching.ts) sur le catalogue
// complet, avec repli automatique et transparent sur le matching par
// mots-clés (suggererSkillsParMotsCles, l'ancienne logique V1) si l'appel
// échoue ou renvoie une réponse invalide — jamais d'erreur visible ici.
export async function suggererSkills(besoin: string): Promise<Skill[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("skills_catalogue").select("*");

  if (error) throw new Error(error.message);

  const skills = data ?? [];
  const parGemini = await suggererSkillsParGemini(besoin, skills);
  return parGemini ?? suggererSkillsParMotsCles(besoin, skills);
}
