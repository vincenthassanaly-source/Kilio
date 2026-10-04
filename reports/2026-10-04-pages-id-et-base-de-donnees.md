# Pages [id] et base de données — 2026-10-04

Deuxième et troisième thèmes du chantier perf (après
`2026-10-04-mesure-performance.md`).

## Base de données (lecture seule, projet `kilio`)

Aucune migration. Advisors de performance : pas de clé étrangère sans index, pas
de problème de RLS ; seulement 21 index « inutilisés ». La plus grosse table
compte 837 lignes (`recette_ingredients_libres`), la plupart moins de 300 : à
cette taille Postgres lit les tables en entier plus vite qu'avec un index, et
supprimer ces index n'apporterait rien (ils serviront si les données grossissent).

Requêtes les plus coûteuses (`pg_stat_statements`) : toutes viennent de `pg_cron`
/ `pg_net` (job `net.http_post` ≈ chaque minute, 47 000 appels à ≈ 10 ms), pas de
l'app. `cron.job_run_details` grossit (47 000 lignes) : nettoyage possible, sans
effet sur la vitesse ressentie.

## Pages [id] : 2 sur 7 concernées

L'audit annonçait 7 pages `"use client"` + `use(params)` à convertir. En relisant :

- **Pharmacie (5 pages)** : elles lisent un snapshot local unique
  (`useSnapshotPharmacie`, via `AvecSnapshot`), pas une donnée serveur par id.
  `use(params)` ne sert qu'à lire l'id. Rien à précharger : laissées en l'état.
- **`collection/[id]` et `objectifs/[id]`** : page client + `useQuery`, choix
  délibéré (`2026-09-12-tanstack-query-objectifs-collection-agenda.md`) pour
  partager le cache avec les mutations optimistes. Les repasser en Server
  Components purs aurait défait cette migration. Elles souffraient du défaut
  décrit dans `2026-09-03-dashboard-hydration-tanstack-query.md` : la donnée
  n'était demandée (Server Action) qu'après le téléchargement et l'hydratation
  du JS.

Correction : même patron que `objectifs/page.tsx` : `page.tsx` async précharge
via `makeServerQueryClient().prefetchQuery` et `HydrationBoundary`, la vue client
(`CollectionDetailView`, `ObjectifDetailView`) garde `useQuery` avec les mêmes
`queryKeys`. Mutations optimistes et message inline « introuvable » inchangés.

Garde-fou : `e2e/detail-pages.spec.ts` (+ une collection et un objectif dans le
faux Supabase). (1) la coquille (lien retour + barre du bas) reste servie sous
`instant()` ; (2) la donnée est présente dans le HTML sans JavaScript. Le
test (2) échoue sur l'ancien code et passe sur le nouveau. Rig complet : 169 ✓,
1 ignoré (déjà le cas avant).
