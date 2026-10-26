import { connection } from "next/server";
import { getRecettesListeEnCache } from "@/lib/nutrition/recettes-cache";
import { AddRecetteToggle } from "./AddRecetteToggle";
import { RecettesList } from "./RecettesList";
import {
  hasNutritionOverride,
  nutritionFromOverride,
  nutritionRecette,
} from "@/lib/nutrition/compute";
import { screenTitle } from "@/lib/ui";
import { NutritionSubNav } from "@/components/NutritionSubNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ErrorInlineRefresh } from "@/components/ErrorInlineRefresh";

export default async function RecettesPage() {
  await connection();
  let recettes: Awaited<ReturnType<typeof getRecettesListeEnCache>>;
  try {
    recettes = await getRecettesListeEnCache();
  } catch (error) {
    console.error("Recettes : lecture impossible", error);
    return (
      <div className="flex flex-col gap-4">
        <NutritionSubNav />
        <h1 className={screenTitle}>Recettes</h1>
        <ErrorInlineRefresh message="Impossible de charger les recettes." />
      </div>
    );
  }

  const views = recettes.map((recette) => {
    const { recette_ingredients, recette_ingredients_libres, ...rest } = recette;
    const kcalParPortion = hasNutritionOverride(recette)
      ? nutritionFromOverride(recette, 1).kcal
      : nutritionRecette(recette_ingredients, recette.portions, 1).kcal;

    const ingredientsText = [
      ...recette_ingredients.map((ri) => ri.aliment?.nom ?? ""),
      ...(recette_ingredients_libres ?? []).map((ril) => ril.nom),
    ]
      .join(" ")
      .toLowerCase();

    return {
      ...rest,
      kcalParPortion: Math.round(kcalParPortion),
      ingredientsText,
    };
  });

  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <NutritionSubNav />
        <h1 className={screenTitle}>Recettes</h1>
        <AddRecetteToggle />
        <RecettesList recettes={views} />
      </div>
    </PullToRefresh>
  );
}
