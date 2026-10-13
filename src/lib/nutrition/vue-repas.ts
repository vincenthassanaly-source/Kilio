import {
  hasNutritionOverride,
  nutritionAliment,
  nutritionFromOverride,
  nutritionRecette,
  type Nutrition,
  type RecetteNutritionOverride,
} from "@/lib/nutrition/compute";

type MacrosPour100 = {
  kcal_100g: number;
  proteines_100g: number;
  glucides_100g: number;
  lipides_100g: number;
};

type AlimentRepas = MacrosPour100 & {
  nom: string;
  unite: "g" | "ml" | "piece";
  poids_unite_g: number | null;
};

type RecetteRepas = RecetteNutritionOverride & {
  nom: string;
  portions: number;
  recette_ingredients: { quantite: number; aliment: MacrosPour100 }[];
};

/** Une ligne de `journal_repas` ou de `menus_repas`, jointe à son aliment ou sa recette. */
export type EntreeRepas = {
  quantite: number;
  aliment: AlimentRepas | null;
  recette: RecetteRepas | null;
};

export type VueRepas = { label: string; detail: string; nutrition: Nutrition };

/**
 * Libellé, détail de quantité et macros d'une ligne de repas : le même calcul
 * pour le Journal et pour les Menus, donc les mêmes chiffres des deux côtés.
 * `null` pour une entrée orpheline (aliment et recette supprimés en base).
 */
export function vueRepas(entree: EntreeRepas): VueRepas | null {
  if (entree.aliment) {
    const { quantite, aliment } = entree;
    // La quantité est toujours en grammes/ml, y compris pour un aliment
    // "pièce" (converti avant l'insert via poids_unite_g) : on affiche donc le
    // poids réel, avec l'équivalent en pièces en rappel.
    const piecesEquivalent =
      aliment.unite === "piece" && aliment.poids_unite_g ? quantite / aliment.poids_unite_g : null;
    const detail =
      piecesEquivalent !== null
        ? `${quantite} g (≈ ${
            Number.isInteger(piecesEquivalent) ? piecesEquivalent : piecesEquivalent.toFixed(1)
          } pièce${piecesEquivalent > 1 ? "s" : ""})`
        : `${quantite} ${aliment.unite === "ml" ? "ml" : "g"}`;
    return { label: aliment.nom, detail, nutrition: nutritionAliment(aliment, quantite) };
  }

  const recette = entree.recette;
  if (!recette) return null;
  return {
    label: recette.nom,
    detail: `${entree.quantite} portion${entree.quantite > 1 ? "s" : ""}`,
    nutrition: hasNutritionOverride(recette)
      ? nutritionFromOverride(recette, entree.quantite)
      : nutritionRecette(recette.recette_ingredients, recette.portions, entree.quantite),
  };
}
