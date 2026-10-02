// Tag de cache des lectures de la bibliothèque d'exercices (voir cache.ts).
// Les exercices sont des données statiques importées par script
// (scripts/sport/importer-exercices.mjs) : aucune Server Action de l'app ne les
// modifie. Après un ré-import, expirer ce tag (revalidateTag) ou attendre la
// fin de `cacheLife` pour voir les changements.
export const SPORT_EXERCICES_TAG = "sport-exercices";
