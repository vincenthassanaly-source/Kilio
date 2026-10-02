import { cacheLife, cacheTag } from "next/cache";
import { getNotesAvecRelations, type NoteAvecRelations } from "@/app/actions/notes";
import { NOTES_TAG } from "@/lib/notes/tags";

// Lecture en cache serveur pour le prefetch de /notes : la liste sort du
// cache en quelques ms au lieu d'un aller-retour Supabase, et arrive avec la
// page au lieu d'un aller-retour client après l'hydratation. `revalidate`
// borne la fraîcheur face à une écriture hors app (nettoyage automatique des
// éléments cochés) ; `stale: 0` impose au routeur client de redemander le
// serveur à chaque navigation. Le client continue de lire en direct.
export async function getNotesAvecRelationsEnCache(): Promise<NoteAvecRelations[]> {
  "use cache";
  cacheTag(NOTES_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getNotesAvecRelations();
}
