"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addNutrition,
  hasNutritionOverride,
  nutritionAliment,
  nutritionFromOverride,
  nutritionRecette,
  zeroNutrition,
  extraireRecents,
  type CatalogueItem,
  type Nutrition,
  type SaisieRecente,
} from "@/lib/nutrition/compute";
import { jourTypePourDate, type JourType } from "@/lib/nutrition/planning";
import { lireSaisieRepas } from "@/lib/nutrition/saisie-repas";

export type JournalFormState = { error: string | null; ok?: boolean };

// Résumé nutritionnel du jour (consommé + objectif), utilisé par la carte
// Nutrition du dashboard (src/app/(app)/DashboardNutritionCard.tsx) via
// TanStack Query — même calcul que celui fait en Server Component dans
// src/app/(app)/nutrition/journal/page.tsx, exposé ici en lecture
// côté client.
export type ResumeNutritionJour = {
  consomme: Nutrition;
  jourType: JourType;
  // Jour libre (jeton posé) : la limite kcal est suspendue pour cette date.
  jourLibre: boolean;
  // null : aucun objectif défini pour ce type de jour (plus de cible
  // inventée, constat J-P1-5).
  kcalGoal: number | null;
  macroGoals: { proteines: number; glucides: number; lipides: number } | null;
};

// Dates (YYYY-MM-DD) marquées « entraînement » entre `debut` et `fin`
// incluses (table jours_entrainement) ; toute autre date est un jour de repos.
export async function getDatesEntrainement(debut: string, fin: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("jours_entrainement")
    .select("date")
    .eq("entraine", true)
    .gte("date", debut)
    .lte("date", fin);
  if (error) throw new Error(error.message);
  return (data ?? []).map((ligne) => ligne.date);
}

export async function getResumeNutritionJour(date: string): Promise<ResumeNutritionJour> {
  const supabase = createAdminClient();
  const jourType = jourTypePourDate(date, await getDatesEntrainement(date, date));

  const [
    { data: objectif, error: erreurObjectif },
    { data: entries, error: erreurJournal },
    { data: jourLibre, error: erreurJourLibre },
  ] = await Promise.all([
    supabase.from("objectifs_nutritionnels").select("*").eq("jour_type", jourType).maybeSingle(),
    supabase
      .from("journal_repas")
      .select(
        "*, aliment:aliments(*), recette:recettes(id, nom, portions, kcal_portion, proteines_portion, glucides_portion, lipides_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g, proteines_100g, glucides_100g, lipides_100g)))"
      )
      .eq("date", date),
    supabase.from("jours_libres").select("date").eq("date", date).maybeSingle(),
  ]);

  // Une panne Supabase ne doit pas passer pour un « journal vide » (0 kcal,
  // pas d'objectif) : on lève, TanStack Query garde alors les données déjà
  // affichées et les écrans montrent leur état d'erreur.
  const erreur = erreurObjectif ?? erreurJournal ?? erreurJourLibre;
  if (erreur) throw new Error(erreur.message);

  // Même filtre des entrées orphelines que JournalJour.tsx (constat J-P1-5).
  const consomme = (entries ?? []).reduce((acc, entry) => {
    if (entry.aliment) return addNutrition(acc, nutritionAliment(entry.aliment, entry.quantite));
    const recette = entry.recette;
    if (!recette) return acc;
    return addNutrition(
      acc,
      hasNutritionOverride(recette)
        ? nutritionFromOverride(recette, entry.quantite)
        : nutritionRecette(recette.recette_ingredients, recette.portions, entry.quantite)
    );
  }, zeroNutrition());

  return {
    consomme,
    jourType,
    jourLibre: jourLibre !== null && jourLibre !== undefined,
    kcalGoal: objectif?.kcal_cible ?? null,
    macroGoals: objectif
      ? {
          proteines: objectif.proteines_cible_g,
          glucides: objectif.glucides_cible_g,
          lipides: objectif.lipides_cible_g,
        }
      : null,
  };
}

export type CatalogueJournal = { items: CatalogueItem[]; recents: SaisieRecente[] };

/**
 * Catalogue du sélecteur d'ajout de repas : tous les aliments et recettes
 * (quelques centaines de lignes, recherche faite côté client pour rester
 * instantanée) et les dernières saisies dédoublonnées (« récents »).
 */
export async function getCatalogueJournal(): Promise<CatalogueJournal> {
  const supabase = createAdminClient();
  const [aliments, recettes, dernieres] = await Promise.all([
    supabase
      .from("aliments")
      .select("id, nom, categorie, unite, poids_unite_g, kcal_100g, proteines_100g, glucides_100g, lipides_100g")
      .order("nom"),
    supabase
      .from("recettes")
      .select(
        "id, nom, portions, kcal_portion, proteines_portion, glucides_portion, lipides_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g, proteines_100g, glucides_100g, lipides_100g))"
      )
      .order("nom"),
    supabase
      .from("journal_repas")
      .select("aliment_id, recette_id, quantite, moment")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  if (aliments.error || recettes.error) {
    throw new Error("Catalogue indisponible.");
  }

  const items: CatalogueItem[] = [
    ...(aliments.data ?? []).map(
      (a): CatalogueItem => ({
        type: "aliment",
        id: a.id,
        nom: a.nom,
        categorie: a.categorie,
        unite: a.unite,
        poidsUniteG: a.poids_unite_g,
        par100: nutritionAliment(a, 100),
      })
    ),
    ...(recettes.data ?? []).map(
      (r): CatalogueItem => ({
        type: "recette",
        id: r.id,
        nom: r.nom,
        parPortion: hasNutritionOverride(r)
          ? nutritionFromOverride(r, 1)
          : nutritionRecette(r.recette_ingredients, r.portions || 1, 1),
      })
    ),
  ];

  return { items, recents: extraireRecents(dernieres.data ?? []) };
}

export async function addJournalEntry(
  _prevState: JournalFormState,
  formData: FormData
): Promise<JournalFormState> {
  const lecture = await lireSaisieRepas(formData);
  if ("error" in lecture) return { error: lecture.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("journal_repas").insert(lecture.saisie);

  if (error) return { error: "Le repas n'a pas pu être ajouté. Réessaie." };

  revalidatePath("/nutrition/journal");
  revalidatePath("/");
  return { error: null, ok: true };
}

export async function removeJournalEntry(id: string) {
  const supabase = createAdminClient();
  // Un repas de Menu validé pointe vers cette entrée (clé étrangère `on delete
  // set null`) : sans ceci il resterait « mangé » alors que le Journal n'a plus
  // la ligne (kcal sous-comptés, repas exclu des Courses). On le remet « à manger ».
  const { data: menusLies, error: erreurMenu } = await supabase
    .from("menus_repas")
    .update({ mange: false, journal_repas_id: null })
    .eq("journal_repas_id", id)
    .select("id");
  if (erreurMenu) throw new Error(erreurMenu.message);

  const { error } = await supabase.from("journal_repas").delete().eq("id", id);

  if (error) {
    // Suppression refusée : on rétablit le lien du menu pour rester cohérent.
    const idsMenu = (menusLies ?? []).map((menu) => menu.id);
    if (idsMenu.length > 0) {
      await supabase.from("menus_repas").update({ mange: true, journal_repas_id: id }).in("id", idsMenu);
    }
    throw new Error(error.message);
  }

  revalidatePath("/nutrition/menus");
  revalidatePath("/nutrition/journal");
  // Le dashboard affiche le total nutrition : comme addJournalEntry.
  revalidatePath("/");
}
