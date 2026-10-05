import { connection } from "next/server";
import { aujourdhuiParis } from "@/lib/date/paris";

export type JourJournal = { date: string };
export type JournalSearchParams = Promise<{ date?: string }>;

/**
 * Jour affiché par le Journal, lu dans l'URL (`?date`). Appelé uniquement
 * sous `<Suspense>` : la coquille de la page (sous-navigation, titre, cadre
 * de navigation par jour) ne dépend ni de l'URL ni de la date.
 *
 * Sans `?date`, le jour affiché est aujourd'hui : une donnée de requête,
 * d'où `connection()` avant `new Date()` (rien ne fige « aujourd'hui » au
 * build ni dans un cache). Avec `?date` (liens ‹ ›, swipe), rien ne dépend
 * de la requête.
 *
 * Le type du jour (repos / entraînement) ne vient pas de l'URL : il est
 * marqué par date depuis le Journal (voir `jourTypePourDate`).
 */
export async function lireJourJournal(searchParams: JournalSearchParams): Promise<JourJournal> {
  const { date: dateParam } = await searchParams;
  if (!dateParam) await connection();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : aujourdhuiParis();
  return { date };
}
