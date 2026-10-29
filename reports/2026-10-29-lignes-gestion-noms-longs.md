# Lignes de gestion — noms longs qui poussaient les boutons hors de la carte

## Constat

Capture de l'écran **Documents › Étiquettes** : « Attestation d'assurance
habitation » et « Attestation d'assurance véhicule » repoussaient « Modifier » et
« Suppr. » hors de la carte, où ils étaient coupés à droite.

## Cause

Le nom (`nameText`, qui impose `truncate`) était dans un bloc sans `min-w-0`, à
côté d'une rangée de boutons en `shrink-0` : le texte ne pouvait pas rétrécir
et poussait les boutons dehors. Même disposition (nom à côté de boutons qui ne
rétrécissent pas) dans l'écran Catégories et dans trois écrans de recettes.

## Décision (skill ui-ux-pro-max, règle « Essential Text Truncation »)

Un nom qui distingue l'élément des autres (ici, « …habitation » et « …véhicule »
ne diffèrent qu'à la fin) ne doit pas être tronqué avec « … » : il passe à la
ligne, en entier. Les boutons forment une rangée alignée à droite **sous** le
texte, ce qui garde des cibles de 44 px et un espacement de 8 px.

## Changement

- `src/lib/ui.ts` : deux styles partagés, `nameTextComplet` (nom à la ligne, sans
  coupe) et `actionsLigne` (rangée de boutons sous le texte, alignée à droite).
  `nameText` (tronqué) reste pour les listes denses d'une seule ligne.
- Écrans corrigés : Étiquettes (`EtiquettesManager`), Catégories
  (`CategoriesManager`), et Nutrition › Recettes : `EtapesManager`,
  `IngredientManager`, `IngredientsLibresManager`.
- Les modes édition (champs, boutons OK / Annuler), les actions et les données
  ne changent pas ; seule la disposition des lignes change.

## Vérification

- `src/components/LignesGestion.test.tsx` : un nom long reste affiché en entier
  (pas de `truncate`), les boutons sont dans leur rangée dédiée, hors du bloc du
  nom, et le conteneur du texte porte `min-w-0`. Vérifié : le test **échoue sur
  l'ancien `EtiquettesManager`** et passe avec le correctif.
- `tsc`, `eslint` propres ; `vitest` : 156 fichiers, 1858 tests ; `next build`
  réussi.
- **Non vérifié** : le rendu réel sur téléphone (pas de navigateur dans cet
  environnement). Le test contrôle la structure, pas les pixels.
- `IngredientManager` (ingrédients liés à un aliment) est corrigé de la même
  façon mais n'a pas de test dédié ; il partage les mêmes styles.
