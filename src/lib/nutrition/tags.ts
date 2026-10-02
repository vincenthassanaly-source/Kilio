// Tag de cache de la liste des recettes (voir recettes-cache.ts). Dans son
// propre fichier pour que les Server Actions qui l'expirent ne dépendent pas
// du module de lecture.
//
// Expiré par updateTag dans toute écriture qui modifie ce que la liste lit :
// recettes (actions/recettes.ts), ingrédients (actions/recette-ingredients.ts)
// et ingrédients libres (actions/recette-ingredients-libres.ts). Les étapes
// n'y figurent pas : la liste ne les lit pas. Le catalogue `aliments` n'est
// jamais écrit par l'app (scripts SQL) : son rafraîchissement dépend du TTL.
export const RECETTES_TAG = "recettes";
