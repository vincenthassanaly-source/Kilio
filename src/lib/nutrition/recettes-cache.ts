import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECETTES_TAG } from "@/lib/nutrition/tags";

// Lecture en cache serveur de la liste des recettes (avec les macros des
// ingrédients, pour calculer les kcal par portion) : elle sort du cache en
// quelques ms au lieu d'un aller-retour Supabase. Une erreur Supabase lève :
// une exception n'est jamais mise en cache, la page affiche son message
// d'erreur et le prochain rendu relit la base. `revalidate` borne la fraîcheur
// face à une modification du catalogue d'aliments (scripts SQL) ; `stale: 0`
// impose au routeur client de redemander le serveur à chaque navigation.
export async function getRecettesListeEnCache() {
  "use cache";
  cacheTag(RECETTES_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("recettes")
    .select(
      "*, recette_ingredients(quantite, aliment:aliments(nom, kcal_100g, proteines_100g, glucides_100g, lipides_100g)), recette_ingredients_libres(nom)"
    )
    .order("nom", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
