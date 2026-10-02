import { cacheLife, cacheTag } from "next/cache";
import { getBibliothequeExercices, type BibliothequeExercices } from "@/app/actions/sport";
import { SPORT_EXERCICES_TAG } from "@/lib/sport/tags";

// Lecture en cache serveur de la bibliothèque (page Exercices) : données
// statiques, donc fraîcheur longue. Une bibliothèque vide (import pas encore
// fait) n'est gardée que quelques secondes, pour apparaître dès que les
// lignes sont chargées plutôt qu'au bout d'une heure.
export async function getBibliothequeEnCache(): Promise<BibliothequeExercices> {
  "use cache";
  cacheTag(SPORT_EXERCICES_TAG);

  const bibliotheque = await getBibliothequeExercices();
  if (bibliotheque.exercices.length === 0) {
    cacheLife({ stale: 0, revalidate: 10, expire: 60 });
  } else {
    cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  }
  return bibliotheque;
}
