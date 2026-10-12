// Calculs de la synthèse santé (kcal moyens, séances, poids lissé, tour de
// taille). La logique vit dans l'Edge Function du bilan hebdomadaire — source
// unique, pour que l'écran et la notification affichent les mêmes chiffres —
// et est réexportée ici ; ce module y ajoute le seul pont propre à l'app.
import type { JourBilan } from "@/lib/nutrition/bilan";
import type { JourKcal } from "../../../supabase/functions/envoyer-bilan-hebdo/compose";

export {
  evolutionPoids,
  evolutionTaille,
  formaterDelta,
  nombreFr,
  poidsLisse,
  syntheseKcal,
  type EvolutionCorps,
  type Mesure,
  type SyntheseHebdo,
} from "../../../supabase/functions/envoyer-bilan-hebdo/compose";

/** Jours du Bilan (statuts déjà évalués) vus comme des jours de kcal à moyenner. */
export function joursKcalDepuisBilan(jours: readonly JourBilan[], today: string): JourKcal[] {
  return jours.map((jour) => ({
    date: jour.date,
    kcal: jour.consomme.kcal,
    cible: jour.cible?.kcal ?? null,
    nbRepas: jour.nbRepas,
    libre: jour.statut === "libre",
    aujourdhui: jour.date === today,
  }));
}
