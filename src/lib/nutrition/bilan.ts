import { shiftDate } from "@/lib/date/iso";
import { jourTypePourDate, type JourType } from "./planning";
import {
  addNutrition,
  hasNutritionOverride,
  nutritionAliment,
  nutritionFromOverride,
  nutritionRecette,
  zeroNutrition,
  type Nutrition,
  type RecetteNutritionOverride,
} from "./compute";

// Bilan nutrition : verdict « dans les clous » par jour, sur une période.
// Règle : kcal ≤ cible (plafond) ET protéines ≥ cible (plancher). Fonctions
// pures : la page Bilan charge les données, ce module juge et agrège.

// Un dépassement kcal ≤10 % reste « léger » (ambre), au-delà « marqué »
// (rouge) : même seuil que l'anneau du Journal (ResumeJour.tsx).
export const SEUIL_DEPASSEMENT_LEGER = 1.1;

export type { JourType };

type MacrosAliment = {
  kcal_100g: number;
  proteines_100g: number;
  glucides_100g: number;
  lipides_100g: number;
};

export type EntreeJournal = {
  date: string;
  quantite: number;
  aliment: MacrosAliment | null;
  recette:
    | (RecetteNutritionOverride & {
        portions: number;
        recette_ingredients: { quantite: number; aliment: MacrosAliment }[];
      })
    | null;
};

/** Nutrition d'une entrée du journal ; `null` pour une entrée orpheline
 * (ni aliment ni recette, référence supprimée en base) — ignorée comme dans
 * le Journal. */
export function nutritionEntree(entree: EntreeJournal): Nutrition | null {
  if (entree.aliment) return nutritionAliment(entree.aliment, entree.quantite);
  const recette = entree.recette;
  if (!recette) return null;
  return hasNutritionOverride(recette)
    ? nutritionFromOverride(recette, entree.quantite)
    : nutritionRecette(recette.recette_ingredients, recette.portions, entree.quantite);
}

// glucides / lipides : renseignés seulement quand l'appelant affiche aussi les
// jauges de macros (suivi d'un objectif Nutrition) ; le verdict ne les lit pas.
export type CiblesJour = { kcal: number; proteines: number; glucides?: number; lipides?: number };

export type StatutJour =
  | "reussi"
  | "rate"
  // Aujourd'hui, tant que les kcal ne sont pas dépassées : la journée n'est
  // pas finie, les protéines peuvent encore être atteintes.
  | "en_cours"
  // Aucun repas saisi : ni réussi ni raté, hors taux et série.
  | "vide"
  | "sans_objectif";

export type Gravite = "leger" | "marque";

export type JourBilan = {
  date: string;
  jourType: JourType;
  statut: StatutJour;
  consomme: Nutrition;
  cible: CiblesJour | null;
  nbRepas: number;
  /** Renseignée seulement quand `statut === "rate"`. */
  gravite: Gravite | null;
};

export function evaluerJour(params: {
  consomme: Nutrition;
  cible: CiblesJour | null;
  nbRepas: number;
  estAujourdhui: boolean;
  /** `false` : seules les kcal décident (objectif Nutrition). Défaut `true`. */
  proteinesRequises?: boolean;
}): { statut: StatutJour; gravite: Gravite | null } {
  const { consomme, cible, nbRepas, estAujourdhui, proteinesRequises = true } = params;
  if (nbRepas === 0) return { statut: "vide", gravite: null };
  if (!cible || cible.kcal <= 0) return { statut: "sans_objectif", gravite: null };

  // Comparaison sur les valeurs arrondies : c'est ce que le Journal affiche
  // (« 2000 / 2000 kcal » doit être un jour réussi).
  const kcal = Math.round(consomme.kcal);
  const proteines = Math.round(consomme.proteines);

  if (kcal > cible.kcal) {
    return { statut: "rate", gravite: kcal / cible.kcal <= SEUIL_DEPASSEMENT_LEGER ? "leger" : "marque" };
  }
  if (estAujourdhui) return { statut: "en_cours", gravite: null };
  if (proteinesRequises && proteines < cible.proteines) return { statut: "rate", gravite: "leger" };
  return { statut: "reussi", gravite: null };
}

/**
 * Bilan des `nbJours` derniers jours jusqu'à `aujourdhui` inclus, du plus
 * ancien au plus récent. `joursEntrainement` : planning hebdomadaire (jours
 * ISO 1 à 7) qui décide du type de chaque jour, vide = repos partout. Les
 * cibles sont celles d'aujourd'hui, non historisées.
 */
export function construireBilan(params: {
  aujourdhui: string;
  nbJours: number;
  entrees: EntreeJournal[];
  joursEntrainement: readonly number[];
  cibles: Record<JourType, CiblesJour | null>;
  proteinesRequises?: boolean;
}): JourBilan[] {
  const { aujourdhui, nbJours, entrees, joursEntrainement, cibles, proteinesRequises } = params;

  const parDate = new Map<string, { consomme: Nutrition; nbRepas: number }>();
  for (const entree of entrees) {
    const nutrition = nutritionEntree(entree);
    if (!nutrition) continue;
    const courant = parDate.get(entree.date) ?? { consomme: zeroNutrition(), nbRepas: 0 };
    parDate.set(entree.date, {
      consomme: addNutrition(courant.consomme, nutrition),
      nbRepas: courant.nbRepas + 1,
    });
  }

  const jours: JourBilan[] = [];
  for (let i = nbJours - 1; i >= 0; i--) {
    const date = shiftDate(aujourdhui, -i);
    const jourType = jourTypePourDate(date, joursEntrainement);
    const { consomme, nbRepas } = parDate.get(date) ?? { consomme: zeroNutrition(), nbRepas: 0 };
    const cible = cibles[jourType];
    const { statut, gravite } = evaluerJour({
      consomme,
      cible,
      nbRepas,
      estAujourdhui: date === aujourdhui,
      proteinesRequises,
    });
    jours.push({ date, jourType, statut, consomme, cible, nbRepas, gravite });
  }
  return jours;
}

/** Jours réussis sur jours jugés (réussi ou raté) ; les autres statuts ne
 * comptent pas. */
export function tauxReussite(jours: JourBilan[]): { reussis: number; evalues: number } {
  let reussis = 0;
  let evalues = 0;
  for (const jour of jours) {
    if (jour.statut === "reussi") {
      reussis++;
      evalues++;
    } else if (jour.statut === "rate") {
      evalues++;
    }
  }
  return { reussis, evalues };
}

/**
 * Série de jours réussis consécutifs jusqu'à aujourd'hui. Un jour raté la
 * coupe ; un jour vide, en cours ou sans objectif la laisse intacte.
 * `tronquee` : la série remonte jusqu'au début de la fenêtre, elle est donc
 * peut-être plus longue.
 */
export function serieEnCours(jours: JourBilan[]): { jours: number; tronquee: boolean } {
  let serie = 0;
  for (let i = jours.length - 1; i >= 0; i--) {
    const { statut } = jours[i];
    if (statut === "rate") return { jours: serie, tronquee: false };
    if (statut === "reussi") serie++;
  }
  return { jours: serie, tronquee: serie > 0 };
}
