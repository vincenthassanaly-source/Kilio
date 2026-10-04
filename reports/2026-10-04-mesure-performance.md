# Mesure de performance — 2026-10-04

Première PR du chantier perf (une PR par thème : mesure, base de données, pages
`[id]`). Objectif : vitesse ressentie, en mesurant avant d'optimiser.

## Ajouts

- `npm run analyze` : `next experimental-analyze --output`, écrit dans
  `.next/diagnostics/analyze` (copier le dossier pour comparer avant/après).
- `@vercel/speed-insights` monté dans le layout racine : Web Vitals réels
  (LCP, INP, CLS) visibles dans le tableau de bord Vercel. **À activer une fois
  dans Vercel : projet > Speed Insights > Enable.** Sans cela, rien n'est collecté.

## Baseline JS (build de prod, route `/`, gzip)

JS de première charge ≈ 283 Ko gzip (20 chunks). Principaux :

| Chunk | gzip | Contenu |
|---|---|---|
| `3f-do3rytnwfm` | 73 Ko | react-dom |
| `2mkv71m6erh78` (+2 petits) | ≈ 63 Ko au total | framer-motion |
| `0cz1d0mv5g_q7`, `01dcdznk0-ccp` | 39 + 35 Ko | runtime Next / code partagé |

Hors première charge (bien différés) : pdfjs (≈ 154 Ko gzip), dexie (≈ 31 Ko).

## Décision framer-motion

`reports/2026-09-30-audit-performance.md` a déjà testé `LazyMotion` + `m.*` :
−80 Ko de JS mais TBT dégradé (ex. habitudes 336 → 513 ms). Non livré, donc on
**ne retente pas** cette piste. Les chiffres ci-dessus confirment le poids, pas
l'intérêt de l'alléger.

## Note installation

`npm i` seul échoue (conflit de peer deps vite/vitest déjà présent) et
`--legacy-peer-deps` casse `npm ci` (retire `@testing-library/dom`). Le paquet a
été ajouté avec `--force` ; `npm ci` vérifié.
