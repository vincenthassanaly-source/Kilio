// Alertes nutrition : logique pure (aucune API Deno ni réseau), testée côté app
// (src/lib/nutrition/alertes.test.ts, qui vérifie aussi la parité du calcul kcal
// avec src/lib/nutrition/compute.ts : une Edge Function ne peut pas l'importer).

/** Part de la limite kcal à partir de laquelle l'alerte part. */
const SEUIL_ALERTE_KCAL = 0.85;

type AlimentKcal = { kcal_100g: number };

export type EntreeKcal = {
  quantite: number;
  aliment: AlimentKcal | null;
  recette: {
    portions: number;
    kcal_portion: number | null;
    recette_ingredients: { quantite: number; aliment: AlimentKcal }[];
  } | null;
};

/** kcal d'une entrée du journal ; `null` pour une entrée orpheline (ni aliment ni recette). */
export function kcalEntree(entree: EntreeKcal): number | null {
  if (entree.aliment) return (entree.aliment.kcal_100g * entree.quantite) / 100;
  const recette = entree.recette;
  if (!recette) return null;
  if (recette.kcal_portion != null) return recette.kcal_portion * entree.quantite;
  const total = recette.recette_ingredients.reduce((somme, ing) => somme + (ing.aliment.kcal_100g * ing.quantite) / 100, 0);
  return (total / recette.portions) * entree.quantite;
}

export function resumeKcal(entrees: readonly EntreeKcal[]): { kcal: number; nbRepas: number } {
  let kcal = 0;
  let nbRepas = 0;
  for (const entree of entrees) {
    const valeur = kcalEntree(entree);
    if (valeur === null) continue;
    kcal += valeur;
    nbRepas++;
  }
  return { kcal, nbRepas };
}

export type NiveauAlerteKcal = "approche" | "depasse";

/**
 * Faut-il alerter ? Une seule fois par jour, jamais un jour libre. Comparaison
 * sur les kcal arrondies, comme le Journal (« 2000 / 2000 » n'est pas un
 * dépassement).
 */
export function alerteKcalDue(input: {
  kcal: number;
  cible: number | null;
  jourLibre: boolean;
  dejaEnvoyee: boolean;
}): NiveauAlerteKcal | null {
  if (input.dejaEnvoyee || input.jourLibre || !input.cible || input.cible <= 0) return null;
  const kcal = Math.round(input.kcal);
  if (kcal > input.cible) return "depasse";
  return kcal >= input.cible * SEUIL_ALERTE_KCAL ? "approche" : null;
}

export function composerAlerteKcal(input: {
  niveau: NiveauAlerteKcal;
  kcal: number;
  cible: number;
}): { title: string; body: string } {
  const kcal = Math.round(input.kcal);
  if (input.niveau === "depasse") {
    return {
      title: "Objectif kcal dépassé",
      body: `${kcal} / ${input.cible} kcal (+${kcal - input.cible}). Demain repart de zéro.`,
    };
  }
  return {
    title: "Limite kcal bientôt atteinte",
    body: `${kcal} / ${input.cible} kcal : il te reste ${input.cible - kcal} kcal aujourd'hui.`,
  };
}

/** Faut-il rappeler de saisir les repas ? Journal vide, heure atteinte, une fois par jour. */
export function rappelSaisieDu(input: {
  today: string;
  maintenantMinutes: number; // minutes depuis minuit, heure de Paris
  heure: string; // HH:MM[:SS]
  nbRepas: number;
  dernierEnvoi: string | null;
  toleranceMin?: number;
}): boolean {
  if (input.nbRepas > 0 || input.dernierEnvoi === input.today) return false;
  const [h, m] = input.heure.split(":").map(Number);
  const ecart = input.maintenantMinutes - (h * 60 + m);
  return ecart >= 0 && ecart <= (input.toleranceMin ?? 180);
}

export function composerRappelSaisie(): { title: string; body: string } {
  return {
    title: "Rien de saisi aujourd'hui",
    body: "Ajoute tes repas du jour pour garder un bilan fiable.",
  };
}
