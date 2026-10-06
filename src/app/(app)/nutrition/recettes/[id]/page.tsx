import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RecetteHeader } from "./RecetteHeader";
import { RecetteMacros } from "./RecetteMacros";
import { IngredientManager } from "./IngredientManager";
import { IngredientsLibresManager } from "./IngredientsLibresManager";
import { EtapesManager } from "./EtapesManager";
import { hasNutritionOverride, nutritionFromOverride, nutritionRecette } from "@/lib/nutrition/compute";
import { pillTag, sectionTitle } from "@/lib/ui";

export default async function RecetteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  const supabase = createAdminClient();

  const [{ data: recette }, { data: ingredients }, { data: aliments }, { data: ingredientsLibres }, { data: etapes }] =
    await Promise.all([
      supabase.from("recettes").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("recette_ingredients")
        .select("*, aliment:aliments(*)")
        .eq("recette_id", id)
        .order("id"),
      supabase.from("aliments").select("*").order("nom", { ascending: true }),
      supabase
        .from("recette_ingredients_libres")
        .select("*")
        .eq("recette_id", id)
        .order("ordre"),
      supabase.from("recette_etapes").select("*").eq("recette_id", id).order("ordre"),
    ]);

  if (!recette) {
    notFound();
  }

  const isHelloFresh = recette.source === "hellofresh";
  const hasIngredientsLibres = (ingredientsLibres ?? []).length > 0;
  const hasEtapes = (etapes ?? []).length > 0;
  const overridden = hasNutritionOverride(recette);
  const perPortion = overridden
    ? nutritionFromOverride(recette, 1)
    : nutritionRecette(ingredients ?? [], recette.portions, 1);
  const showMacros = overridden || (ingredients ?? []).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <RecetteHeader recette={recette} />
      {showMacros && <RecetteMacros recetteId={recette.id} nom={recette.nom} perPortion={perPortion} detail={overridden ? recette : undefined} />}

      {recette.ustensiles && recette.ustensiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Ustensiles</h2>
          <div className="flex flex-wrap gap-1.5">
            {recette.ustensiles.map((u) => (
              <span key={u} className={pillTag}>
                {u}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Ingrédients</h2>
        {isHelloFresh ? (
          <IngredientsLibresManager recetteId={id} ingredients={ingredientsLibres ?? []} />
        ) : (
          <>
            <IngredientManager
              recetteId={id}
              ingredients={ingredients ?? []}
              aliments={aliments ?? []}
              hideEmptyMessage={hasIngredientsLibres}
            />
            {hasIngredientsLibres && (
              <IngredientsLibresManager recetteId={id} ingredients={ingredientsLibres ?? []} />
            )}
          </>
        )}
      </div>

      {(isHelloFresh || hasEtapes) && (
        <div className="flex flex-col gap-3">
          <h2 className={sectionTitle}>Étapes</h2>
          <EtapesManager recetteId={id} etapes={etapes ?? []} />
        </div>
      )}
    </div>
  );
}
