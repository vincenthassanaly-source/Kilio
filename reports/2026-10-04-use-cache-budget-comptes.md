# 'use cache' sur le Budget et les Comptes — 2026-10-04

Quatrième thème du chantier perf (après mesure, base de données, pages `[id]`).

## Changement

- `src/lib/budget/cache.ts` : `getComptesAvecSoldeEnCache`, `getResumeMoisEnCache`,
  `getSuiviCategoriesEnCache` (`'use cache'`, tag `budget`, `{ stale: 0,
  revalidate: 60, expire: 3600 }`, comme les autres modules).
- Utilisés par `/budget` (vue d'ensemble) et `/budget/comptes`. Le solde d'un
  compte relit toutes les transactions : c'est la lecture la plus coûteuse.
- Tag `BUDGET_TAG` (`src/lib/budget/tags.ts`) expiré par `updateTag` dans toutes
  les écritures de `comptes`, `transactions`, `budgets`, `categories-budget` et
  `transactions-recurrentes`. Le test `invalidation-cache.test.ts` couvre ces
  cinq fichiers (vérifié : retirer un `updateTag` le fait échouer).

## Point délicat : génération des récurrences au rendu

`/budget` génère les occurrences récurrentes dues à chaque requête
(`genererOccurrencesDuesPourLaRequete`), c'est une écriture. `updateTag` est
interdit au rendu : elle ne peut donc pas expirer le cache. `genererOccurrencesDues`
renvoie maintenant `true` quand elle a écrit, et la page lit alors en direct
pour cette requête. Le cache, lui, peut rester périmé jusqu'à la fin de son
`revalidate` (60 s) : cas rare (une fois par échéance de récurrence), même
tolérance que pour une écriture hors app sur les autres modules.

## Hors périmètre (non caché)

Transactions, Catégories, Statistiques, Calendrier, Récurrences : elles
dépendent de filtres ou de périodes en `searchParams` ; à traiter séparément si
la mesure (Speed Insights) le justifie.

## Vérifications

lint, typecheck, knip OK ; vitest 539 ✓ ; rig e2e complet 169 ✓ (1 ignoré,
comme avant).
