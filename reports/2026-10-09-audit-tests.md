# Audit des tests — 2026-10-09

Phase 1 de la campagne de tests (audit, puis unitaire, E2E, perf et a11y).
Environnement : données locales (faux Supabase du rig e2e), sans vrai Supabase.

## Résultats de base

| Contrôle | Résultat |
|---|---|
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| Vitest | 62 fichiers, 637 tests, tous verts |
| Playwright (rig `test:instant`) | 94 verts, **2 en échec**, 6 non exécutés |

## Couverture unitaire (v8, tout `src/`)

Lignes 22,9 % (6043 / 26394) · fonctions 57,1 % · branches 80,2 %.
La couverture est très inégale : la logique pure testée (`src/lib`) est bien couverte,
le reste est presque à zéro.

| Zone | Lignes | Couverture |
|---|---|---|
| `src/app/(app)` (écrans) | 16 845 | 17 % (166 fichiers sur 191 à 0 %) |
| `src/app/actions` (server actions) | 3 542 | 2 % (17 fichiers sur 23 à 0 %) |
| `src/lib/*` (logique pure) | ~3 500 | majoritairement 70–100 % |
| `src/components`, `src/hooks` | ~1 300 | très inégal |

### Trous prioritaires (code métier, ordre de risque)

1. **Server actions** : `taches` (804 lignes, 3 %), `objectifs`, `documents`, `notes`,
   `collections`, `habitudes`, `journal`, `recherche`, `recettes*`, `courses`,
   `pharmacie`, `evenements`, `inbox`, `briefing`.
2. **Logique `src/lib` sous-couverte** : `offline/queue.ts` (26 %), `agenda/compute.ts`
   (19 %), `taches/creation-rapide.ts`, `navigation/preferences.ts`, `images/compression.ts`
   (47 %), `collection/youtube.ts` et `tiktok.ts`, `push/subscribe.ts`, `pdf/apercuPdf.ts`,
   `gemini/appel.ts`, `pharmacie/cache.ts`, `theme.ts`.
3. **Hooks et composants d'interaction à 0 %** : `useSwipeHorizontal`, `useScrollRestoration`,
   `BottomNav`, `PullToRefresh`, `ConfirmDialog`, `TabSwipeWrapper`, `ThemeToggle`.
4. **Routes `api/` et `collection/`** : 0 %.

Cible convenue : 80 % sur le code métier (`src/lib`, `src/app/actions`, `src/hooks`),
en excluant l'UI purement visuelle.

## E2E : 2 échecs sur `aujourdhui.spec.ts`

Test : « affiche l'événement, la tâche du jour et le résumé des repas » (desktop et mobile).
Cause : l'assertion sur la carte « Plan du jour » dépend de l'heure d'exécution. Le jeu de
données contient une tâche de 30 min ; quand le test tourne en soirée (ici 20 h 22 UTC),
il n'y a plus de créneau libre, et la carte affiche « Aucun trou libre aujourd'hui » au lieu
de la tâche. Ce n'est pas un bug de l'app : c'est un test fragile. Il passera ou échouera
selon l'heure, y compris en CI.
À faire : figer l'horloge du test (ou de la page) sur un créneau de journée.

Les 6 tests « non exécutés » sont la conséquence du mode `serial` : ils suivent l'échec.

## Dépendance ajoutée

`@vitest/coverage-v8@^3.2.7` (devDependency), alignée sur Vitest 3.2.7. Absente jusque-là,
la couverture n'était pas mesurable.

## Suite

1. Corriger le test E2E fragile (horloge figée).
2. Tests unitaires : `src/lib` sous-couvert, puis server actions (client Supabase mocké).
3. Hooks et composants d'interaction.
4. E2E : parcours non couverts (specs actuelles : aujourd'hui, détail, journal, parité,
   préférences, navigation instantanée).
5. Perf (Lighthouse) et accessibilité.
