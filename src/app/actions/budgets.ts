"use server";

import { revalidatePath, updateTag } from "next/cache";
import { BUDGET_TAG } from "@/lib/budget/tags";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bornesPeriode,
  premierJourDeLAnnee,
  premierJourDeLaSemaine,
  premierJourDuMois,
  statutBudget,
  type StatutBudget,
} from "@/lib/budget/compute";
import type { Enums, Tables } from "@/lib/supabase/types";

export type BudgetFormState = { error: string | null };

const TYPES_PERIODE: readonly Enums<"type_periode_budget">[] = ["hebdomadaire", "mensuel", "annuel"];

/** Upsert par (categorie_id, periode, type_periode) : un seul montant cible par
 * catégorie, par type de période (semaine/mois/année) et par période — les 3
 * types peuvent coexister sur une même catégorie, indépendamment les uns des
 * autres. */
export async function upsertBudget(
  _prevState: BudgetFormState,
  formData: FormData
): Promise<BudgetFormState> {
  const categorie_id = String(formData.get("categorie_id") ?? "").trim();
  const periodeRaw = String(formData.get("periode") ?? "").trim();
  const typePeriodeRaw = String(formData.get("type_periode") ?? "");
  const montantRaw = String(formData.get("montant_cible") ?? "").trim();

  if (!categorie_id) return { error: "La catégorie est requise." };
  if (!periodeRaw) return { error: "La période est requise." };
  if (!TYPES_PERIODE.includes(typePeriodeRaw as Enums<"type_periode_budget">)) {
    return { error: "Type de période invalide." };
  }
  const type_periode = typePeriodeRaw as Enums<"type_periode_budget">;

  const montant_cible = Number(montantRaw);
  if (!Number.isFinite(montant_cible) || montant_cible < 0) {
    return { error: "Le montant cible doit être un nombre positif ou nul." };
  }

  // La période reçue du client est re-calée côté serveur (jamais telle
  // quelle) au premier jour de la semaine/mois/année concerné — cf. contrainte
  // `budgets_periode_calee` en base, qui rejetterait sinon une valeur non
  // calée avant même d'atteindre ce code.
  const [annee, mois, jour] = periodeRaw.split("-").map(Number);
  const dateReference = new Date(annee, (mois || 1) - 1, jour || 1);
  const periode =
    type_periode === "hebdomadaire"
      ? premierJourDeLaSemaine(dateReference)
      : type_periode === "annuel"
        ? premierJourDeLAnnee(dateReference)
        : premierJourDuMois(dateReference);

  const supabase = createAdminClient();

  // Le budget cible se définit uniquement sur les catégories principales : le
  // suivi (getSuiviCategories) agrège déjà les dépenses des sous-catégories
  // dans le total de leur parent, cf. décision documentée dans le rapport.
  const { data: categorie, error: categorieError } = await supabase
    .from("categories_budget")
    .select("categorie_parent_id")
    .eq("id", categorie_id)
    .maybeSingle();
  if (categorieError) return { error: categorieError.message };
  if (categorie?.categorie_parent_id) {
    return { error: "Le budget cible se définit sur la catégorie principale, pas sur une sous-catégorie." };
  }

  const { error } = await supabase
    .from("budgets")
    .upsert(
      { categorie_id, periode, type_periode, montant_cible },
      { onConflict: "categorie_id,periode,type_periode" }
    );

  if (error) return { error: error.message };

  revalidatePath("/budget");
  revalidatePath("/budget/categories");
  updateTag(BUDGET_TAG);
  return { error: null };
}

export type SuiviCategorie = {
  categorie: Tables<"categories_budget">;
  budget: Tables<"budgets"> | null;
  consomme: number;
  cible: number;
  statut: StatutBudget;
};

/**
 * Pour chaque catégorie principale de dépense, calcule la somme des
 * transactions de la période (celles de la catégorie elle-même **et** de ses
 * sous-catégories, agrégées dans un seul total) vs le montant cible du
 * budget, avec un statut ok / proche / dépassé pour piloter l'indicateur
 * visuel (cf. `statutBudget`).
 *
 * Décision : le suivi de dépassement n'a qu'un niveau de granularité, celui
 * de la catégorie principale — les sous-catégories n'ont pas de budget cible
 * indépendant (cf. `upsertBudget`, qui le refuse), quel que soit le type de
 * période. Une catégorie principale sans sous-catégorie se comporte
 * exactement comme avant.
 *
 * @param periode Format "YYYY-MM-DD" (premier jour de la semaine/du mois/de
 * l'année selon `typePeriode`).
 * @param typePeriode Défaut `"mensuel"` : un appel `getSuiviCategories(periode)`
 * sans ce paramètre continue de fonctionner exactement comme avant.
 */
export async function getSuiviCategories(
  periode: string,
  typePeriode: Enums<"type_periode_budget"> = "mensuel"
): Promise<SuiviCategorie[]> {
  const supabase = createAdminClient();
  const { debut, fin } = bornesPeriode(periode, typePeriode);

  const [
    { data: categories, error: categoriesError },
    { data: budgets, error: budgetsError },
    { data: transactions, error: transactionsError },
  ] = await Promise.all([
    supabase.from("categories_budget").select("*").eq("type", "depense").order("nom"),
    supabase.from("budgets").select("*").eq("periode", periode).eq("type_periode", typePeriode),
    supabase
      .from("transactions")
      .select("categorie_id, montant")
      .eq("type", "depense")
      .gte("date_operation", debut)
      .lt("date_operation", fin),
  ]);

  if (categoriesError) throw new Error(categoriesError.message);
  if (budgetsError) throw new Error(budgetsError.message);
  if (transactionsError) throw new Error(transactionsError.message);

  const categoriesPrincipales = (categories ?? []).filter((c) => !c.categorie_parent_id);

  return categoriesPrincipales.map((categorie) => {
    const idsInclus = new Set([
      categorie.id,
      ...(categories ?? [])
        .filter((c) => c.categorie_parent_id === categorie.id)
        .map((c) => c.id),
    ]);
    const budget = (budgets ?? []).find((b) => b.categorie_id === categorie.id) ?? null;
    const consomme = (transactions ?? [])
      .filter((t) => t.categorie_id && idsInclus.has(t.categorie_id))
      .reduce((acc, t) => acc + t.montant, 0);
    const cible = budget?.montant_cible ?? 0;

    return { categorie, budget, consomme, cible, statut: statutBudget(consomme, cible) };
  });
}
