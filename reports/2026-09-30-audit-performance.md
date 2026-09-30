# Audit de performance — 2026-09-30

Périmètre décidé : LCP/FCP et fluidité (INP/CLS), build de prod local
(`next build` + `next start`) contre le faux Supabase du rig (`instant-nav.rig.md`,
latence simulée 400 ms), Lighthouse mobile (throttling simulé par défaut).
Routes clés : journal nutrition, tâches, habitudes (agenda), collection, documents.
Garde-fous : aucun changement visuel, animations conservées, mode hors-ligne intact.

## Baseline (un run, Lighthouse mobile)

| Route | Perf | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| `/` | 78 | 967 ms | 4301 ms | 326 ms | 0,006 |
| `/nutrition/journal` | 87 | 918 ms | 3437 ms | 230 ms | 0 |
| `/taches` | 78 | 810 ms | 4612 ms | 283 ms | 0 |
| `/agenda` | 94 | 766 ms | 1816 ms | 261 ms | 0 |
| `/habitudes` | 74 | 766 ms | 5057 ms | 327 ms | 0 |
| `/collection` | 78 | 762 ms | 4899 ms | 242 ms | 0 |
| `/documents` | 88 | 812 ms | 3581 ms | 187 ms | 0 |

Le bruit entre deux runs est important (journal : 72 puis 87 sans changement de
code) : toute comparaison ci-dessous utilise la médiane de 3 runs.

## Constats

1. **L'élément LCP est du contenu streamé**, pas une image ni un bloc lourd
   (ex. `/habitudes` : le texte « Aucune habitude pour l'instant. », délai de
   rendu de l'élément ≈ 0,9 s). Il attend la réponse du faux Supabase (400 ms)
   puis l'hydratation sous throttling CPU. Le LCP mesuré ici dépend donc surtout
   de la latence simulée et n'est pas représentatif d'un gain de code.
2. **Le temps de script est dominé par le framework** : sur `/habitudes`, ≈ 1,7 s
   d'évaluation de script dont ≈ 1,3 s dans deux chunks (runtime Next ≈ 126 Ko et
   react-dom ≈ 229 Ko non compressés). Le code de la page elle-même pèse ≈ 370 ms.
3. **JS de première charge** (non compressé, `next experimental-analyze`) :
   730–840 Ko par route, dont seulement 30–100 Ko propres à la route. Le
   partagé contient react-dom (229 Ko), runtime Next (126 Ko), framer-motion
   (130 Ko), @dnd-kit (47 Ko), react-query, date-fns.
4. **Le rendu serveur est déjà sain** : coquilles statiques (`◐` Partial
   Prerender sur presque toutes les routes), `Promise.all` sur les lectures
   indépendantes, `Suspense` par section, polices via `next/font`, aucun script
   tiers, CLS ≈ 0. Ce travail vient des rapports du 2026-09-24.

## Expérience tentée puis annulée : `LazyMotion` + `m.*`

Objectif : sortir framer-motion (`layout`/`layoutId` → `domMax`) du JS initial.
Résultat côté bundle : −80 Ko non compressés de première charge (≈ −10 %).
Résultat mesuré (médiane de 3 runs, base → variante) :

| Route | TBT | Bootup |
|---|---|---|
| journal | 219 → 363 ms | 1703 → 1946 ms |
| taches | 251 → 332 ms | 1612 → 1808 ms |
| habitudes | 336 → 513 ms | 1696 → 1881 ms |
| collection | 278 → 289 ms | 1504 → 1531 ms |

Octets transférés inchangés (les fonctionnalités se chargent juste après
l'hydratation) et TBT plutôt dégradé. **Non livré.** Aucun code applicatif n'a
été modifié.

## Pistes restantes (non traitées)

- **@dnd-kit dans le layout** (≈ 47 Ko + contextes) : monté pour l'édition de la
  barre du bas ; le différer demande de restructurer `NavigationEditContext` et
  touche à un comportement tactile sensible. À faire avec un test d'interaction.
- **Mesure avec la vraie latence Supabase** : le rig alternatif (preview Vercel,
  voir `instant-nav.rig.md`) est nécessaire pour juger le LCP et d'éventuels
  waterfalls de données côté base, que le faux Supabase masque.
- **Part de composants client (≈ 68 % des fichiers)** : à auditer route par
  route pour repérer ceux qui n'ont pas besoin de `"use client"`, seulement si une
  mesure réelle montre l'hydratation comme goulot.
- Requêtes Supabase et index : hors périmètre décidé pour cette session.

## Reproduire

```
E2E_SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=e2e-dummy npx next build
node e2e/mock-supabase.mjs &      # faux Supabase
npx next start --port 3100
npx lighthouse http://localhost:3100/<route> --only-categories=performance
npx next experimental-analyze --output   # .next/diagnostics/route-bundle-stats.json
```
