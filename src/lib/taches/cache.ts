import { cacheLife, cacheTag } from "next/cache";
import { getListes, getTachesAvecRelations, type TacheAvecRelations } from "@/app/actions/taches";
import type { Tables } from "@/lib/supabase/types";
import { TACHES_TAG } from "@/lib/taches/tags";

// Lectures en cache serveur pour les prefetch (pages Tâches et Agenda, carte
// du Dashboard) : tâches et listes sortent du cache en quelques ms au lieu
// d'un aller-retour Supabase. Le tag est expiré par toute écriture de
// actions/taches.ts et par la route reporter-rappel ; `revalidate` borne la
// fraîcheur face à une écriture hors app (edge function de rappels, nettoyage
// automatique) ; `stale: 0` impose au routeur client de redemander le
// serveur à chaque navigation. Le client continue de lire en direct.
export async function getTachesAvecRelationsEnCache(): Promise<TacheAvecRelations[]> {
  "use cache";
  cacheTag(TACHES_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getTachesAvecRelations();
}

export async function getListesEnCache(): Promise<Tables<"listes_taches">[]> {
  "use cache";
  cacheTag(TACHES_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getListes();
}
