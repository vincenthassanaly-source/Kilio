import { connection } from "next/server";
import { aujourdhuiParis } from "@/lib/date/paris";
import { semaineDepuisParam } from "@/lib/menus/compute";

export type MenusSearchParams = Promise<{ semaine?: string }>;

export type SemaineMenus = {
  /** Lundi de la semaine affichée (AAAA-MM-JJ). */
  lundi: string;
  /** Aujourd'hui à Paris : sert à repérer le jour courant et la semaine courante. */
  aujourdhui: string;
};

/** Query d'une semaine des Menus, identifiée par son lundi. */
export const hrefSemaineMenus = (lundi: string) => `/nutrition/menus?semaine=${lundi}`;

/**
 * Semaine affichée par les Menus, lue dans l'URL (`?semaine`). Appelé
 * uniquement sous `<Suspense>` : la coquille de la page (sous-navigation,
 * titre) ne dépend ni de l'URL ni de la date. « Aujourd'hui » est une donnée
 * de requête, d'où `connection()` avant `new Date()`.
 */
export async function lireSemaineMenus(searchParams: MenusSearchParams): Promise<SemaineMenus> {
  const { semaine } = await searchParams;
  await connection();
  const aujourdhui = aujourdhuiParis();
  return { lundi: semaineDepuisParam(semaine, aujourdhui), aujourdhui };
}
