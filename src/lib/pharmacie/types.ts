import type { Tables } from "@/lib/supabase/types";

// Tout le module Pharmacie lit un seul instantané (arborescence + notions +
// cartes) : quelques centaines à quelques milliers de lignes de texte court,
// donc une requête, un cache TanStack Query et une copie Dexie pour le
// hors-ligne (voir useSnapshotPharmacie).
export type PharmaMatiere = Tables<"pharma_matieres">;
export type PharmaChapitre = Tables<"pharma_chapitres">;
export type PharmaNotion = Tables<"pharma_notions">;
// `huile_id` / `he_type` ne servent qu'à l'action des huiles essentielles
// (synchronisation des cartes) : la révision n'en a pas besoin.
export type PharmaCarte = Omit<Tables<"pharma_cartes">, "created_at" | "huile_id" | "he_type">;

export type PharmaSnapshot = {
  matieres: PharmaMatiere[];
  chapitres: PharmaChapitre[];
  notions: PharmaNotion[];
  cartes: PharmaCarte[];
  /** ISO : moment de la lecture serveur (affiché quand on lit la copie locale). */
  genereLe: string;
};
