import { cacheLife, cacheTag } from "next/cache";
import { getComptesAvecSolde, type CompteAvecSolde } from "@/app/actions/comptes";
import { getSuiviCategories, type SuiviCategorie } from "@/app/actions/budgets";
import { getResumeMois, type ResumeMois } from "@/app/actions/transactions";
import { BUDGET_TAG } from "@/lib/budget/tags";

// Lectures en cache serveur pour la Vue d'ensemble du Budget et la page
// Comptes : le solde de chaque compte relit toutes les transactions, ce qui
// coûte plusieurs aller-retours Supabase. Le tag est expiré par toute écriture
// des actions Budget (comptes, transactions, budgets, catégories,
// récurrences) ; `revalidate` borne la fraîcheur face à une écriture hors app
// ou à la génération des occurrences récurrentes au rendu (voir
// budget/requete.ts, qui lit en direct quand elle a écrit) ; `stale: 0` impose
// au routeur client de redemander le serveur à chaque navigation.
export async function getComptesAvecSoldeEnCache(): Promise<CompteAvecSolde[]> {
  "use cache";
  cacheTag(BUDGET_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getComptesAvecSolde();
}

export async function getResumeMoisEnCache(periode: string): Promise<ResumeMois> {
  "use cache";
  cacheTag(BUDGET_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getResumeMois(periode);
}

export async function getSuiviCategoriesEnCache(periode: string): Promise<SuiviCategorie[]> {
  "use cache";
  cacheTag(BUDGET_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getSuiviCategories(periode);
}
