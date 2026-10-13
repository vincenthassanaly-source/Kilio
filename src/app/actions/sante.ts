"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { shiftDate } from "@/lib/date/iso";
import { aujourdhuiParis } from "@/lib/date/paris";
import { getDatesEntrainement } from "@/app/actions/journal";
import { getJoursLibres } from "@/app/actions/jours-libres";
import { construireBilan, type CiblesJour, type JourType } from "@/lib/nutrition/bilan";
import { estJourType } from "@/lib/nutrition/planning";
import { progressionSemaine } from "@/lib/seances/compute";
import { lireSemaine } from "@/lib/seances/serveur";
import {
  evolutionPoids,
  evolutionTaille,
  joursKcalDepuisBilan,
  syntheseKcal,
  type Mesure,
  type SyntheseHebdo,
} from "@/lib/sante/compute";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// Fenêtre de relevés lue pour lisser le poids et comparer à la semaine d'avant.
const NB_JOURS_MESURES = 60;
const COLONNES_MESURE = "date, poids_kg, tour_taille_cm";

type LigneMesure = { date: string; poids_kg: number | string | null; tour_taille_cm: number | string | null };

// numeric revient en nombre ou en chaîne selon le client : toujours normalisé.
const enNombre = (valeur: number | string | null): number | null => (valeur === null ? null : Number(valeur));
const enMesure = (l: LigneMesure): Mesure => ({
  date: l.date,
  poids_kg: enNombre(l.poids_kg),
  tour_taille_cm: enNombre(l.tour_taille_cm),
});

export type SyntheseSemaine = SyntheseHebdo & {
  /** Date du relevé le plus récent (poids ou taille), `null` sans aucun relevé. */
  derniereMesure: string | null;
};

/** Derniers relevés du corps, les plus récents d'abord. */
export async function getMesuresRecentes(nb = 8): Promise<Mesure[]> {
  const { data, error } = await createAdminClient()
    .from("mesures_corps")
    .select(COLONNES_MESURE)
    .order("date", { ascending: false })
    .limit(nb);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LigneMesure[]).map(enMesure);
}

/**
 * Synthèse de la semaine : kcal moyens des 7 derniers jours contre leur limite,
 * séances faites / prévues (lundi → dimanche), poids lissé et tour de taille.
 * Mêmes chiffres que la notification du dimanche (cf. sante/compute.ts).
 */
export async function getSyntheseSemaine(today: string): Promise<SyntheseSemaine> {
  if (!DATE_REGEX.test(today)) throw new Error("Date invalide.");
  const supabase = createAdminClient();
  const debut = shiftDate(today, -6);

  const [objectifs, repas, seances, mesures, datesEntrainement, joursLibres] = await Promise.all([
    supabase.from("objectifs_nutritionnels").select("*"),
    supabase
      .from("journal_repas")
      .select(
        "date, quantite, aliment:aliments(*), recette:recettes(id, nom, portions, kcal_portion, proteines_portion, glucides_portion, lipides_portion, recette_ingredients(quantite, aliment:aliments(kcal_100g, proteines_100g, glucides_100g, lipides_100g)))"
      )
      .gte("date", debut)
      .lte("date", today),
    lireSemaine(supabase, today),
    supabase
      .from("mesures_corps")
      .select(COLONNES_MESURE)
      .gte("date", shiftDate(today, -NB_JOURS_MESURES))
      .lte("date", today)
      .order("date"),
    getDatesEntrainement(debut, today),
    getJoursLibres(debut, today),
  ]);
  const erreur = objectifs.error ?? repas.error ?? mesures.error;
  if (erreur) throw new Error(erreur.message);

  const cibles: Record<JourType, CiblesJour | null> = { repos: null, entrainement: null };
  for (const o of objectifs.data ?? []) {
    if (estJourType(o.jour_type)) cibles[o.jour_type] = { kcal: o.kcal_cible, proteines: o.proteines_cible_g };
  }

  const jours = construireBilan({
    aujourdhui: today,
    nbJours: 7,
    entrees: repas.data ?? [],
    datesEntrainement,
    cibles,
    joursLibres,
  });
  const releves = ((mesures.data ?? []) as LigneMesure[]).map(enMesure);

  return {
    kcal: syntheseKcal(joursKcalDepuisBilan(jours, today)),
    seances: progressionSemaine(seances.groupes),
    poids: evolutionPoids(releves, today),
    taille: evolutionTaille(releves, today),
    derniereMesure: releves.length > 0 ? releves[releves.length - 1].date : null,
  };
}

export type MesureInput = { date: string; poidsKg: number | null; tourTailleCm: number | null };

const dansIntervalle = (valeur: number, min: number, max: number) => Number.isFinite(valeur) && valeur >= min && valeur <= max;
const arrondi1 = (valeur: number) => Math.round(valeur * 10) / 10;

function revalider() {
  revalidatePath("/nutrition/bilan");
  revalidatePath("/revue");
  revalidatePath("/aujourdhui");
}

/**
 * Enregistre un relevé (poids et/ou tour de taille) à une date. Une valeur
 * absente ne touche pas celle déjà enregistrée ce jour-là : on peut saisir le
 * tour de taille après le poids.
 */
export async function enregistrerMesure(input: MesureInput): Promise<ActionResult> {
  if (!DATE_REGEX.test(input.date)) return fail("Date invalide.");
  if (input.date > aujourdhuiParis()) return fail("Un relevé ne peut pas être daté dans le futur.");
  if (input.poidsKg === null && input.tourTailleCm === null) return fail("Saisis ton poids ou ton tour de taille.");
  if (input.poidsKg !== null && !dansIntervalle(input.poidsKg, 30, 300)) {
    return fail("Le poids doit être compris entre 30 et 300 kg.");
  }
  if (input.tourTailleCm !== null && !dansIntervalle(input.tourTailleCm, 40, 250)) {
    return fail("Le tour de taille doit être compris entre 40 et 250 cm.");
  }

  const { error } = await createAdminClient()
    .from("mesures_corps")
    .upsert(
      {
        date: input.date,
        ...(input.poidsKg !== null && { poids_kg: arrondi1(input.poidsKg) }),
        ...(input.tourTailleCm !== null && { tour_taille_cm: arrondi1(input.tourTailleCm) }),
      },
      { onConflict: "date" }
    );
  if (error) return fail("Le relevé n'a pas pu être enregistré. Réessaie.");

  revalider();
  return ok();
}

export async function supprimerMesure(date: string): Promise<ActionResult> {
  if (!DATE_REGEX.test(date)) return fail("Date invalide.");
  const { error } = await createAdminClient().from("mesures_corps").delete().eq("date", date);
  if (error) return fail("Le relevé n'a pas pu être supprimé. Réessaie.");

  revalider();
  return ok();
}
