"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  anneesDePlage,
  anneesManquantes,
  parseReponseEtalab,
  type JourFerie,
} from "@/lib/feries/compute";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const URL_ETALAB = "https://calendrier.api.gouv.fr/jours-feries/metropole";
const TIMEOUT_MS = 5000;

async function lirePlage(debut: string, fin: string): Promise<JourFerie[]> {
  const { data, error } = await createAdminClient()
    .from("jours_feries")
    .select("date, nom")
    .gte("date", debut)
    .lte("date", fin)
    .order("date");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Récupère une année chez Etalab et la copie en base. Jamais d'exception :
// sans réseau ou si l'API est en panne, l'app continue sans fériés.
async function importerAnnee(annee: number): Promise<void> {
  try {
    const reponse = await fetch(`${URL_ETALAB}/${annee}.json`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!reponse.ok) return;
    const lignes = parseReponseEtalab(await reponse.json());
    if (lignes.length === 0) return;
    await createAdminClient().from("jours_feries").upsert(lignes, { onConflict: "date" });
  } catch {
    // Informatif seulement : on réessaiera à la prochaine lecture.
  }
}

/**
 * Jours fériés FR (métropole) entre `debut` et `fin` incluses. Une année absente
 * de la base est importée depuis l'API Etalab à la première lecture ; le 1er
 * janvier, férié chaque année, sert de témoin d'import.
 */
export async function getJoursFeries(debut: string, fin: string): Promise<JourFerie[]> {
  if (!DATE_REGEX.test(debut) || !DATE_REGEX.test(fin)) throw new Error("Date invalide.");
  const annees = anneesDePlage(debut, fin);
  if (annees.length === 0) return [];

  const temoins = await lirePlage(`${annees[0]}-01-01`, `${annees[annees.length - 1]}-01-01`);
  const manquantes = anneesManquantes(
    annees,
    temoins.filter((j) => j.date.endsWith("-01-01"))
  );
  if (manquantes.length > 0) await Promise.all(manquantes.map(importerAnnee));

  return lirePlage(debut, fin);
}
