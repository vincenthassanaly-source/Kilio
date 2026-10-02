"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { COURSES_TAG } from "@/lib/courses/cache";
import type { Tables } from "@/lib/supabase/types";
import { LONGUEUR_MAX_LIBELLE_COURSE, planifierAjoutCourses, PLAFOND_ARTICLES_COURSES } from "@/lib/courses/compute";

export async function getCoursesItems(): Promise<Tables<"courses_items">[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("courses_items")
    .select("*")
    .order("coche", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCourseItem(libelle: string) {
  const trimmed = libelle.trim();
  if (!trimmed) throw new Error("Le libellé est requis.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("courses_items").insert({ libelle: trimmed });

  if (error) throw new Error(error.message);

  revalidatePath("/courses");
  updateTag(COURSES_TAG);
}

export async function toggleCourseItem(id: string, coche: boolean) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("courses_items").update({ coche }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/courses");
  updateTag(COURSES_TAG);
}

export async function deleteCourseItem(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("courses_items").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/courses");
  updateTag(COURSES_TAG);
}

export async function updateCourseItem(id: string, libelle: string) {
  const trimmed = libelle.trim();
  if (!trimmed) throw new Error("Le libellé est requis.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("courses_items").update({ libelle: trimmed }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/courses");
  updateTag(COURSES_TAG);
}

// Suppression groupée par ids exacts (jamais `where coche = true`) : pour
// que « Annuler » (restoreCourseItems ci-dessous) restaure précisément
// l'ensemble d'articles vu par l'utilisateur au moment du tap, même si un
// autre article a été coché entre-temps.
export async function deleteCourseItems(ids: string[]) {
  if (ids.length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("courses_items").delete().in("id", ids);

  if (error) throw new Error(error.message);

  revalidatePath("/courses");
  updateTag(COURSES_TAG);
}

export type ResultatAjoutArticlesCourses = {
  crees: number;
  reactives: number;
  dejaPresents: string[];
};

// Ajout multiple (#2 de l'audit) : valide le lot, relit les articles
// existants (id, libelle, coche seulement — le tri coche asc/created_at desc
// suffit à faire du premier archivé rencontré pour une clé donnée le plus
// récent, voir le commentaire de planifierAjoutCourses) et rejoue
// PLANIFIERAJOUTCOURSES CÔTÉ SERVEUR : le serveur fait foi, y compris au
// rejeu de la file offline avec un cache client périmé (un article vu comme
// "à créer" par le client au moment de la saisie peut très bien être devenu
// "déjà présent" ou "à réactiver" d'ici le rejeu). `created_at` est assigné
// explicitement en `maintenant + i ms` (strictement croissant, dans l'ordre
// de saisie) pour les deux opérations : `created_at DEFAULT now()` donne, en
// pratique, un horodatage IDENTIQUE à toutes les lignes d'un même INSERT
// (vérifié en base, y compris sur des données réelles existantes), ce qui
// rendrait l'ordre d'affichage indéterminé (tri `coche asc, created_at
// desc`). Un `INSERT` unique pour les nouveaux articles, un `UPDATE` par
// article réactivé (jamais d'upsert malin) — jamais les deux mêlés.
export async function ajouterArticlesCourses(libelles: string[]): Promise<ResultatAjoutArticlesCourses> {
  if (libelles.length === 0 || libelles.length > PLAFOND_ARTICLES_COURSES) {
    throw new Error(`Le nombre d'articles doit être entre 1 et ${PLAFOND_ARTICLES_COURSES}.`);
  }

  const trimmes = libelles.map((libelle) => libelle.trim());
  if (trimmes.some((libelle) => !libelle)) {
    throw new Error("Le libellé est requis.");
  }
  const tropLong = trimmes.find((libelle) => libelle.length > LONGUEUR_MAX_LIBELLE_COURSE);
  if (tropLong) {
    throw new Error(`Un article dépasse ${LONGUEUR_MAX_LIBELLE_COURSE} caractères.`);
  }

  const supabase = createAdminClient();
  const { data: existants, error: erreurLecture } = await supabase
    .from("courses_items")
    .select("id, libelle, coche")
    .order("coche", { ascending: true })
    .order("created_at", { ascending: false });

  if (erreurLecture) throw new Error(erreurLecture.message);

  const plan = planifierAjoutCourses(trimmes, existants ?? []);
  const maintenant = Date.now();

  if (plan.aCreer.length > 0) {
    const lignes = plan.aCreer.map((libelle, index) => ({
      libelle,
      created_at: new Date(maintenant + index).toISOString(),
    }));
    const { error } = await supabase.from("courses_items").insert(lignes);
    if (error) throw new Error(error.message);
  }

  const resultatsReactivation = await Promise.all(
    plan.aReactiver.map((article, index) =>
      supabase
        .from("courses_items")
        .update({ coche: false, created_at: new Date(maintenant + plan.aCreer.length + index).toISOString() })
        .eq("id", article.id)
    )
  );
  for (const { error } of resultatsReactivation) {
    if (error) throw new Error(error.message);
  }

  revalidatePath("/courses");
  updateTag(COURSES_TAG);

  return { crees: plan.aCreer.length, reactives: plan.aReactiver.length, dejaPresents: plan.dejaPresents };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CourseItemARestaurer = Pick<
  Tables<"courses_items">,
  "id" | "libelle" | "coche" | "created_at" | "termine_le"
>;

// Réinsère des articles complets (id, libelle, coche, created_at, termine_le
// d'origine — jamais updated_at, qui doit refléter la restauration elle-même,
// pas la création d'origine) pour annuler une suppression unitaire ou
// groupée : l'article revient au même id et à la même place dans la liste.
// `upsert(..., { ignoreDuplicates: true })` sur la clé primaire `id` rend
// l'opération idempotente (rejouer deux fois la même annulation, ex. double
// tap ou rejeu de file après un flush partiel, n'échoue pas et ne duplique
// rien). `set_termine_le()` ne réagit qu'aux UPDATE (voir trigger en base),
// donc un INSERT avec `coche`/`termine_le` explicites n'est jamais réécrit.
export async function restoreCourseItems(items: CourseItemARestaurer[]) {
  if (items.length === 0) return;

  const lignes = items.map((item) => {
    const libelle = item.libelle.trim();
    if (!libelle) throw new Error("Le libellé est requis.");
    if (!UUID_RE.test(item.id)) throw new Error("Identifiant d'article invalide.");
    return {
      id: item.id,
      libelle,
      coche: item.coche,
      created_at: item.created_at,
      termine_le: item.termine_le,
    };
  });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("courses_items")
    .upsert(lignes, { onConflict: "id", ignoreDuplicates: true });

  if (error) throw new Error(error.message);

  revalidatePath("/courses");
  updateTag(COURSES_TAG);
}
