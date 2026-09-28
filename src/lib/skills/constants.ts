import type { Enums } from "@/lib/supabase/types";

export type CategorieSkill = Enums<"categorie_skill">;

export const CATEGORIE_LABELS: Record<CategorieSkill, string> = {
  dev: "Dev & code",
  langages: "Langages (build/review/test)",
  design: "Design & UX",
  produit: "Produit & idéation",
  orchestration: "Orchestration & workflows",
  projet: "Gestion de projet",
  livraison: "Git & livraison",
  automatisation: "Automatisation & hooks",
  contenu: "Contenu & recherche",
};

export const ORDRE_CATEGORIES: readonly CategorieSkill[] = [
  "dev",
  "langages",
  "design",
  "produit",
  "orchestration",
  "projet",
  "livraison",
  "automatisation",
  "contenu",
];
