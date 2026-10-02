import { cacheLife, cacheTag } from "next/cache";
import {
  getBibliothequeExercices,
  getDerniereSeance,
  getRoutines,
  type BibliothequeExercices,
  type DerniereSeance,
  type RoutinesData,
} from "@/app/actions/sport";
import { SPORT_EXERCICES_TAG, SPORT_ROUTINES_TAG, SPORT_SEANCES_TAG } from "@/lib/sport/tags";

// Routines et dernière séance (accueil Sport) : modifiées par l'app, donc
// fraîcheur courte ; `stale: 0` impose au routeur client de redemander le
// serveur à chaque navigation (même réglage que les habitudes).
export async function getRoutinesEnCache(): Promise<RoutinesData> {
  "use cache";
  cacheTag(SPORT_ROUTINES_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getRoutines();
}

export async function getDerniereSeanceEnCache(): Promise<DerniereSeance | null> {
  "use cache";
  cacheTag(SPORT_SEANCES_TAG);
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  return getDerniereSeance();
}

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
