# Baseline de performance — 2026-11-04 (nuit)

Point de départ de la mission de nuit « rendre Kilio plus rapide ». Commit
mesuré : `6484c0e` (`kiliomain`). Rapport final :
`2026-11-04-nuit-performance.md`.

## Méthode

- **Build de production** sans l'API de test : `E2E_SUPABASE_URL=http://localhost:54321
  SUPABASE_SERVICE_ROLE_KEY=e2e-dummy next build`, puis `next start --port 3200`,
  contre le faux Supabase du rig (`e2e/mock-supabase.mjs`, latence 400 ms).
- **JS de première charge** : pour chaque route, le HTML complet (flux compris)
  est téléchargé ; tous les chunks `/_next/static/chunks/*.js` qu'il référence
  (balises `<script>` et références de composants client du payload RSC) sont
  téléchargés et additionnés, brut et gzip (zlib niveau 6). Le polyfill chargé en
  `<script noModule>` (≈ 112 Ko bruts) est exclu : les navigateurs modernes ne le
  téléchargent pas. Les chunks chargés à la demande (`next/dynamic`, `import()`)
  ne comptent pas.
- **Lighthouse 13.6 mobile** (preset par défaut : émulation mobile, 4G lente
  simulée, CPU ×4), performance seulement, médiane de 3 runs, faux Supabase remis
  à zéro avant chaque run.

## JS de première charge

| Route | Brut (Ko) | gzip (Ko) | Chunks |
|---|---|---|---|
| `/` | 870.1 | 275.6 | 22 |
| `/taches` | 887.6 | 280.1 | 21 |
| `/taches/listes` | 802.9 | 253.5 | 20 |
| `/nutrition/journal` | 880.3 | 273.8 | 19 |
| `/nutrition/recettes` | 796.7 | 251.5 | 19 |
| `/nutrition/menus` | 799.5 | 251.7 | 18 |
| `/nutrition/bilan` | 796.4 | 251.7 | 19 |
| `/nutrition` | 777.7 | 244.3 | 17 |
| `/habitudes` | 828.2 | 261.4 | 19 |
| `/courses` | 820.3 | 259.5 | 20 |
| `/notes` | 822.5 | 259.5 | 20 |
| `/agenda` | 892.0 | 283.7 | 22 |
| `/aujourdhui` | 906.6 | 286.2 | 22 |
| `/objectifs` | 815.8 | 257.3 | 19 |
| `/documents` | 833.5 | 264.3 | 20 |
| `/collection` | 837.5 | 264.5 | 19 |
| `/pharmacie` | 826.1 | 261.4 | 21 |
| `/musculation` | 808.0 | 254.4 | 18 |
| `/plus` | 788.9 | 249.1 | 19 |
| `/reglages` | 815.0 | 255.3 | 19 |
| `/revue` | 831.0 | 263.7 | 20 |
| `/scanner` | 926.9 | 295.2 | 21 |
| `/opinions` | 864.0 | 272.9 | 20 |
| `/vider-ma-tete` | 833.8 | 263.6 | 19 |

Commun à toutes les routes (≈ 244 Ko gzip) : react-dom 71,6 ; framer-motion
43,4 ; runtime Next 34,0 ; @dnd-kit/core 15,6 ; react-query et code de la
navigation ≈ 30 ; date-fns + utilitaires 9,3 ; le reste (runtime Turbopack,
Speed Insights, petits chunks Next) ≈ 40.

Le chunk le plus lourd propre à une route est celui du Journal : 92 Ko bruts /
25,5 Ko gzip. C'est le runtime serveur de Next (`next/server`), embarqué par
erreur (voir le rapport final).

## Lighthouse mobile (médiane de 3)

| Route | Perf | FCP | LCP | TBT | CLS | Bootup JS |
|---|---|---|---|---|---|---|
| `/` | 81 | 922 ms | 4433 ms | 219 ms | 0 | 1354 ms |
| `/agenda` | 76 | 910 ms | 4253 ms | 393 ms | 0 | 1617 ms |
| `/aujourdhui` | 79 | 919 ms | 4366 ms | 282 ms | 0 | 1462 ms |
| `/courses` | 84 | 907 ms | 4068 ms | 196 ms | 0 | 1189 ms |
| `/habitudes` | 83 | 909 ms | 3996 ms | 249 ms | 0 | 1216 ms |
| `/notes` | 83 | 908 ms | 4087 ms | 234 ms | 0 | 1223 ms |
| `/nutrition/journal` | 85 | 911 ms | 4037 ms | 154 ms | 0 | 1311 ms |
| `/taches` | 80 | 910 ms | 4024 ms | 328 ms | 0 | 1471 ms |

LCP observé (sans throttling) : 330 à 560 ms, avec un FCP à ~70 ms. Le FCP ne
peint que le bouton de thème. Le titre et la barre du bas n'apparaissent
qu'après l'exécution du JS ; la cause est décrite dans le rapport final.

## Contrôles au départ

- `npm run lint`, `npm run typecheck` : OK.
- `npx vitest run` : 191 fichiers, 2266 tests, tous verts.
- `npm run test:instant` : 140 réussis, 4 échecs, 6 non lancés. Les 4 échecs
  (`aujourdhui.spec.ts:26` et `parite.spec.ts:59`, desktop et mobile) viennent
  de l'heure du run, 23 h-minuit UTC. Le faux Supabase date les données « du
  jour » en UTC alors que l'app raisonne à l'heure de Paris, déjà au lendemain.
  Ce n'est pas un défaut du code de l'app. En CI, ces tests échouent aussi
  entre 23 h et minuit UTC.
- Environnement local : Playwright 1.56.1 (version figée du projet) attend
  Chromium r1194, le sandbox fournit r1243. Les tests ont tourné avec
  `PLAYWRIGHT_BROWSERS_PATH` pointant sur des liens symboliques vers r1243
  (Chromium 153). Rien n'a changé dans le dépôt.
