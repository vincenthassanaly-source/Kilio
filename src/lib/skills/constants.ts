import type { Enums } from "@/lib/supabase/types";

export type CategorieSkill = Enums<"categorie_skill">;

export const CATEGORIE_LABELS: Record<CategorieSkill, string> = {
  dev: "Dev & code",
  langages: "Langages (build/review/test)",
  patterns: "Patterns par framework",
  design: "Design & UX",
  produit: "Produit & idéation",
  orchestration: "Orchestration & agents",
  projet: "Gestion de projet",
  livraison: "Git & livraison",
  automatisation: "Automatisation & hooks",
  infra: "Infra & réseau",
  securite: "Sécurité",
  tests: "Tests & qualité",
  contenu: "Contenu & recherche",
};

export const ORDRE_CATEGORIES: readonly CategorieSkill[] = [
  "dev",
  "langages",
  "patterns",
  "design",
  "produit",
  "orchestration",
  "projet",
  "livraison",
  "automatisation",
  "infra",
  "securite",
  "tests",
  "contenu",
];
