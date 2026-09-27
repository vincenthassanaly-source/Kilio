"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";
import { CATEGORIE_LABELS, ORDRE_CATEGORIES, type CategorieSkill } from "@/lib/skills/constants";

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

// Mode « je ne sais pas quoi choisir » : pas de matching sémantique en V1,
// un score simple par mots communs entre le besoin décrit et
// nom/description/exemples suffit sur un catalogue de ~25 fiches curées.
export async function suggererSkills(besoin: string): Promise<Skill[]> {
  const mots = besoin
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôöùûüç0-9]+/)
    .filter((mot) => mot.length >= 3);

  if (mots.length === 0) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("skills_catalogue").select("*");

  if (error) throw new Error(error.message);

  const scores = (data ?? []).map((skill) => {
    const texte = `${skill.nom} ${skill.description} ${skill.exemples.join(" ")}`.toLowerCase();
    const score = mots.reduce((acc, mot) => acc + (texte.includes(mot) ? 1 : 0), 0);
    return { skill, score };
  });

  return scores
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.skill);
}
