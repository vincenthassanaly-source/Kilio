import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

// Tag expiré (updateTag) par chaque Server Action d'écriture de
// src/app/actions/courses.ts : la lecture en cache ne reste jamais derrière
// une écriture faite depuis l'app.
export const COURSES_TAG = "courses";

// Lecture en cache serveur pour le prefetch de /courses : la liste sort du
// cache en quelques ms au lieu d'un aller-retour Supabase. `revalidate` borne
// la fraîcheur face à une écriture hors app (SQL direct, edge function) ;
// `stale: 0` impose au routeur client de redemander le serveur à chaque
// navigation. Le client continue de lire en direct via getCoursesItems.
export async function getCoursesItemsEnCache(): Promise<Tables<"courses_items">[]> {
  "use cache";
  cacheTag(COURSES_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("courses_items")
    .select("*")
    .order("coche", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
