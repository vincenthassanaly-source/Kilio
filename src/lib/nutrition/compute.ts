export type Nutrition = {
  kcal: number;
  proteines: number;
  glucides: number;
  lipides: number;
};

export function zeroNutrition(): Nutrition {
  return { kcal: 0, proteines: 0, glucides: 0, lipides: 0 };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    proteines: a.proteines + b.proteines,
    glucides: a.glucides + b.glucides,
    lipides: a.lipides + b.lipides,
  };
}

export function scaleNutrition(n: Nutrition, factor: number): Nutrition {
  return {
    kcal: n.kcal * factor,
    proteines: n.proteines * factor,
    glucides: n.glucides * factor,
    lipides: n.lipides * factor,
  };
}

type AlimentMacros = {
  kcal_100g: number;
  proteines_100g: number;
  glucides_100g: number;
  lipides_100g: number;
};

/** Les valeurs nutritionnelles d'un aliment sont toujours données "pour 100 unités"
 * (100g, 100ml ou 100 pièces selon `unite`), donc le calcul est identique quelle que
 * soit l'unité. */
export function nutritionAliment(aliment: AlimentMacros, quantite: number): Nutrition {
  const facteur = quantite / 100;
  return {
    kcal: aliment.kcal_100g * facteur,
    proteines: aliment.proteines_100g * facteur,
    glucides: aliment.glucides_100g * facteur,
    lipides: aliment.lipides_100g * facteur,
  };
}

/** `portionsConsommees` est le nombre de portions de la recette effectivement mangées
 * (peut être fractionnaire, ex. 0.5). */
export function nutritionRecette(
  ingredients: { aliment: AlimentMacros; quantite: number }[],
  portionsTotal: number,
  portionsConsommees: number
): Nutrition {
  const total = ingredients.reduce(
    (acc, ing) => addNutrition(acc, nutritionAliment(ing.aliment, ing.quantite)),
    zeroNutrition()
  );
  const parPortion = scaleNutrition(total, 1 / portionsTotal);
  return scaleNutrition(parPortion, portionsConsommees);
}

/** Override nutritionnel imprimé sur une fiche recette (ex. HelloFresh), saisi
 * directement par portion plutôt que recalculé depuis des ingrédients. */
export type RecetteNutritionOverride = {
  kcal_portion: number | null;
  proteines_portion: number | null;
  glucides_portion: number | null;
  lipides_portion: number | null;
};

export function hasNutritionOverride(r: RecetteNutritionOverride): boolean {
  return r.kcal_portion != null;
}

export function nutritionFromOverride(
  r: RecetteNutritionOverride,
  portionsConsommees: number
): Nutrition {
  return {
    kcal: (r.kcal_portion ?? 0) * portionsConsommees,
    proteines: (r.proteines_portion ?? 0) * portionsConsommees,
    glucides: (r.glucides_portion ?? 0) * portionsConsommees,
    lipides: (r.lipides_portion ?? 0) * portionsConsommees,
  };
}

// ---------------------------------------------------------------------------
// Saisie de repas dans le Journal (vague 1 de l'audit du 2026-09-25)
// ---------------------------------------------------------------------------

export type MomentRepas = "petit_dej" | "dejeuner" | "diner" | "collation";

export const MOMENTS_REPAS: readonly MomentRepas[] = ["petit_dej", "dejeuner", "diner", "collation"];

export const MOMENT_LABELS: Record<MomentRepas, string> = {
  petit_dej: "Petit-déj",
  dejeuner: "Déjeuner",
  diner: "Dîner",
  collation: "Collation",
};

// Complément du bouton d'ajout, accordé au moment (« à la » collation).
export const AJOUT_LABELS: Record<MomentRepas, string> = {
  petit_dej: "au petit-déj",
  dejeuner: "au déjeuner",
  diner: "au dîner",
  collation: "en collation",
};

/**
 * Moment pré-rempli selon l'heure locale (0-23, minutes en fraction) :
 * petit-déj jusqu'à 10 h 30, déjeuner de 11 h à 14 h 30, dîner de 18 h à
 * 22 h, collation le reste du temps. Toujours modifiable en un tap.
 */
export function momentParDefaut(heure: number): MomentRepas {
  if (heure >= 4 && heure < 10.5) return "petit_dej";
  if (heure >= 11 && heure < 14.5) return "dejeuner";
  if (heure >= 18 && heure < 22) return "diner";
  return "collation";
}

export type CatalogueAliment = {
  type: "aliment";
  id: string;
  nom: string;
  categorie: string | null;
  unite: "g" | "ml" | "piece";
  poidsUniteG: number | null;
  par100: Nutrition;
};

export type CatalogueRecette = {
  type: "recette";
  id: string;
  nom: string;
  parPortion: Nutrition;
};

export type CatalogueItem = CatalogueAliment | CatalogueRecette;

/** Dernière saisie connue d'un aliment ou d'une recette (quantité telle que
 * stockée : grammes/ml pour un aliment, portions pour une recette). */
export type SaisieRecente = {
  type: "aliment" | "recette";
  id: string;
  quantite: number;
  moment: MomentRepas;
};

export type ModeSaisie = "grammes" | "piece";

export function cleCatalogue(item: { type: "aliment" | "recette"; id: string }): string {
  return `${item.type}:${item.id}`;
}

/**
 * Dédoublonne les dernières entrées du journal (les plus récentes d'abord)
 * pour en tirer les « récents » : un aliment/une recette n'apparaît qu'une
 * fois, avec sa dernière quantité — « refaire le petit-déj d'hier » en un tap.
 */
export function extraireRecents(
  entrees: { aliment_id: string | null; recette_id: string | null; quantite: number; moment: MomentRepas }[],
  limite = 8
): SaisieRecente[] {
  const vus = new Set<string>();
  const recents: SaisieRecente[] = [];
  for (const e of entrees) {
    const type = e.aliment_id ? "aliment" : e.recette_id ? "recette" : null;
    const id = e.aliment_id ?? e.recette_id;
    if (!type || !id) continue;
    const cle = `${type}:${id}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    recents.push({ type, id, quantite: Number(e.quantite), moment: e.moment });
    if (recents.length >= limite) break;
  }
  return recents;
}

function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Recherche plein texte tolérante aux accents : tous les mots saisis doivent
 * apparaître dans le nom (ou la catégorie). Les noms qui commencent par la
 * requête passent devant, puis ordre alphabétique.
 */
export function rechercherCatalogue(items: CatalogueItem[], requete: string, limite = 40): CatalogueItem[] {
  const q = normaliser(requete);
  if (!q) return [];
  const mots = q.split(/\s+/).filter(Boolean);
  const scores: { item: CatalogueItem; score: number; nom: string }[] = [];
  for (const item of items) {
    const nom = normaliser(item.nom);
    const cible = item.type === "aliment" && item.categorie ? `${nom} ${normaliser(item.categorie)}` : nom;
    if (!mots.every((m) => cible.includes(m))) continue;
    const score = nom.startsWith(q) ? 0 : nom.split(/\s+/).some((w) => w.startsWith(mots[0])) ? 1 : 2;
    scores.push({ item, score, nom });
  }
  scores.sort((a, b) => a.score - b.score || a.nom.localeCompare(b.nom, "fr"));
  return scores.slice(0, limite).map((s) => s.item);
}

/** Mode et valeur de départ du pas-à-pas de quantité. */
export function saisieParDefaut(
  item: CatalogueItem,
  recente?: SaisieRecente
): { mode: ModeSaisie; valeur: number } {
  if (item.type === "recette") return { mode: "grammes", valeur: recente?.quantite ?? 1 };
  const parPiece = item.unite === "piece" && item.poidsUniteG ? item.poidsUniteG : null;
  if (parPiece) {
    const pieces = recente ? Math.round((recente.quantite / parPiece) * 2) / 2 : 1;
    return { mode: "piece", valeur: Math.max(0.5, pieces) };
  }
  return { mode: "grammes", valeur: recente ? Math.round(recente.quantite) : 100 };
}

/** Quantité stockée en base (grammes/ml, ou portions pour une recette). */
export function quantiteStockee(item: CatalogueItem, mode: ModeSaisie, valeur: number): number {
  if (item.type === "aliment" && mode === "piece" && item.poidsUniteG) return valeur * item.poidsUniteG;
  return valeur;
}

/** Valeurs nutritionnelles de la saisie en cours (aperçu avant ajout). */
export function nutritionSaisie(item: CatalogueItem, mode: ModeSaisie, valeur: number): Nutrition {
  if (item.type === "recette") return scaleNutrition(item.parPortion, valeur);
  return scaleNutrition(item.par100, quantiteStockee(item, mode, valeur) / 100);
}

/** Pas du « − / + » selon le mode : ½ portion ou ½ pièce, 10 g sinon. */
export function pasSaisie(item: CatalogueItem, mode: ModeSaisie): number {
  if (item.type === "recette" || mode === "piece") return 0.5;
  return 10;
}
