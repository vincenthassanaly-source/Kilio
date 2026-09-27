import type { Enums } from "@/lib/supabase/types";

export type CategorieSkill = Enums<"categorie_skill">;

export const CATEGORIE_LABELS: Record<CategorieSkill, string> = {
  dev: "Dev & code",
  design: "Design & UX",
  produit: "Produit & idéation",
  livraison: "Git & livraison",
  contenu: "Contenu & recherche",
};

export const ORDRE_CATEGORIES: readonly CategorieSkill[] = ["dev", "design", "produit", "livraison", "contenu"];
