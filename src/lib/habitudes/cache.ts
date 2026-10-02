import { cacheLife, cacheTag } from "next/cache";
import { getHabitudesDuJour, type HabitudeDuJour } from "@/app/actions/habitudes";
import { HABITUDES_TAG } from "@/lib/habitudes/tags";

// Lecture en cache serveur pour les prefetch (page Habitudes, carte du
// Dashboard) : la liste sort du cache en quelques ms au lieu de trois
// allers-retours Supabase. La date fait partie de la clé de cache, donc une
// nouvelle journée ne réutilise jamais les séries de la veille. `revalidate`
// borne la fraîcheur face à une écriture hors app ; `stale: 0` impose au
// routeur client de redemander le serveur à chaque navigation.
export async function getHabitudesDuJourEnCache(date: string): Promise<HabitudeDuJour[]> {
  "use cache";
  cacheTag(HABITUDES_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getHabitudesDuJour(date);
}
