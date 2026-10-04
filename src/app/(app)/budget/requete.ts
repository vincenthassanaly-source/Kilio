import { cache } from "react";
import { connection } from "next/server";
import { genererOccurrencesDues } from "@/app/actions/transactions-recurrentes";
import { normaliserPeriode, periodeParDefaut } from "@/lib/budget/compute";
import type { Enums } from "@/lib/supabase/types";

// Lectures de requête communes aux pages du Budget. Appelées uniquement sous
// <Suspense> : l'en-tête de chaque page (titre, liens, cadre du sélecteur de
// période) reste dans la coquille.

/**
 * Pas de cron dans ce repo : les occurrences récurrentes dues sont générées
 * au rendu, avant les lectures de totaux/historique. C'est une écriture à
 * chaque requête (date du jour), donc jamais dans la coquille ni en cache.
 * Dédoublonnée par requête : une page qui lit ses données depuis plusieurs
 * <Suspense> ne la déclenche qu'une fois.
 *
 * Renvoie `true` si elle a écrit. `updateTag` n'étant pas permis au rendu,
 * elle ne peut pas expirer le cache du Budget (voir lib/budget/cache.ts) : la
 * page lit alors en direct pour cette requête, et le cache se remet à jour
 * au plus tard à la fin de son `revalidate`.
 */
export const genererOccurrencesDuesPourLaRequete = cache(async (): Promise<boolean> => {
  await connection();
  return genererOccurrencesDues();
});

/**
 * Période mensuelle affichée (`?periode=YYYY-MM-01`). Sans paramètre, le mois
 * courant : une donnée de requête, d'où `connection()` avant `new Date()`.
 */
export async function lirePeriodeMensuelle(searchParams: Promise<{ periode?: string }>): Promise<string> {
  const { periode } = await searchParams;
  if (periode) {
    const normalisee = normaliserPeriode(periode, "mensuel");
    if (normalisee) return normalisee;
  }
  await connection();
  return periodeParDefaut("mensuel");
}

const TYPES_PERIODE: readonly Enums<"type_periode_budget">[] = ["hebdomadaire", "mensuel", "annuel"];

/** Type de période et période des Catégories (`?type_periode`, `?periode`). */
export async function lirePeriodeCategories(
  searchParams: Promise<{ type_periode?: string; periode?: string }>
): Promise<{ typePeriode: Enums<"type_periode_budget">; periode: string }> {
  const params = await searchParams;
  const typePeriode = TYPES_PERIODE.includes(params.type_periode as Enums<"type_periode_budget">)
    ? (params.type_periode as Enums<"type_periode_budget">)
    : "mensuel";
  if (params.periode) {
    const normalisee = normaliserPeriode(params.periode, typePeriode);
    if (normalisee) return { typePeriode, periode: normalisee };
  }
  await connection();
  return { typePeriode, periode: periodeParDefaut(typePeriode) };
}
