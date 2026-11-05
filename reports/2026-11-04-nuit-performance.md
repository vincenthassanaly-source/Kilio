# Nuit performance — 2026-11-04 → 05

Mission : rendre Kilio plus rapide (chargement, navigation, fluidité) sans
aucun changement visuel ni fonctionnel. Deux chantiers autorisés : réduire le
JS partagé ; étendre `"use cache"` et les coquilles instantanées. Baseline
détaillée : `2026-11-04-baseline-performance.md`.

## Résumé

- **Le gain majeur de la nuit est une erreur de coquille, pas du poids de JS.**
  Depuis l'adoption de Cache Components, la barre du bas et le contenu de
  **toutes** les pages n'étaient pas rendus par le serveur. Un `Date.now()`
  lu au rendu par `SeanceFlottante` (minuteur de repos) rendait dynamique la
  frontière `<Suspense>` du layout `(app)`, et React rendait tout côté client
  après le chargement du JS (erreur #419 en console sur 15 des 21 routes
  sondées). Au premier affichage, on ne voyait que le bouton de thème.
  Corrigé dans #252 : LCP Lighthouse mobile ≈ 4,1-4,5 s → **0,91 s** sur 5 des
  8 routes mesurées, et TBT en baisse sur les 8 (−32 à −294 ms).
- **JS de première charge** : −10,8 % gzip sur le Journal (#251, `next/server`
  embarqué par erreur), −2,3 % sur 16 routes sur 24 (#254, date-fns hors du
  layout), inchangé sur les 8 routes qui utilisent elles-mêmes date-fns.
  **La cible de −20 % n'est pas atteinte** : les deux seuls postes assez lourds
  (framer-motion 43 Ko gzip, @dnd-kit 16 Ko gzip, dans le JS de toutes les
  pages) ne peuvent pas être différés sans changement visible ou de
  comportement (détail plus bas).
- **LCP < 2,5 s** : atteint sur `/`, `/agenda`, `/aujourdhui`, `/habitudes`
  et `/nutrition/journal` (simulé et throttling réel), et sur `/notes` en
  throttling réel seulement (1,6-1,9 s). **Pas atteint** sur `/courses` et
  `/taches` (≈ 4,4-4,9 s), dont l'élément LCP arrive avec les données : texte
  d'état vide, champ de recherche affiché après la lecture.
- 4 lots fusionnés (#251 à #254), aucun changement de données, aucune
  migration, auth et RLS intactes. 10 routes de plus sont gardées par
  `instant()`, et un nouveau garde-fou vérifie que la coquille est rendue par
  le serveur.

## Baseline et résultats

Méthode identique avant et après (voir la baseline) : build de production sans
API de test, faux Supabase du rig (latence 400 ms), JS = tous les chunks
référencés par le HTML de la route, polyfill `noModule` exclu. Avant :
`6484c0e` ; après : `kiliomain` + #254.

### JS de première charge (Ko)

| Route | Brut avant | Brut après | Écart | gzip avant | gzip après | Écart |
|---|---|---|---|---|---|---|
| `/` | 870,1 | 870,2 | 0,0 % | 275,6 | 275,3 | -0,1 % |
| `/taches` | 887,6 | 887,8 | 0,0 % | 280,1 | 280,7 | 0,2 % |
| `/taches/listes` | 802,9 | 803,0 | 0,0 % | 253,5 | 253,3 | -0,1 % |
| `/nutrition/journal` | 880,3 | 774,6 | -12,0 % | 273,8 | 244,2 | -10,8 % |
| `/nutrition/recettes` | 796,7 | 776,8 | -2,5 % | 251,5 | 245,7 | -2,3 % |
| `/nutrition/menus` | 799,5 | 779,6 | -2,5 % | 251,7 | 245,9 | -2,3 % |
| `/nutrition/bilan` | 796,4 | 776,5 | -2,5 % | 251,7 | 245,8 | -2,3 % |
| `/nutrition` | 777,7 | 757,8 | -2,6 % | 244,3 | 238,4 | -2,4 % |
| `/habitudes` | 828,2 | 828,4 | 0,0 % | 261,4 | 260,7 | -0,3 % |
| `/courses` | 820,3 | 800,4 | -2,4 % | 259,5 | 253,6 | -2,3 % |
| `/notes` | 822,5 | 802,6 | -2,4 % | 259,5 | 253,6 | -2,3 % |
| `/agenda` | 892,0 | 892,0 | 0,0 % | 283,7 | 283,3 | -0,1 % |
| `/aujourdhui` | 906,6 | 906,8 | 0,0 % | 286,2 | 286,8 | 0,2 % |
| `/objectifs` | 815,8 | 795,9 | -2,4 % | 257,3 | 251,5 | -2,3 % |
| `/documents` | 833,5 | 813,6 | -2,4 % | 264,3 | 258,5 | -2,2 % |
| `/collection` | 837,5 | 817,6 | -2,4 % | 264,5 | 258,6 | -2,2 % |
| `/pharmacie` | 826,1 | 806,2 | -2,4 % | 261,4 | 255,5 | -2,2 % |
| `/musculation` | 808,0 | 788,1 | -2,5 % | 254,4 | 248,5 | -2,3 % |
| `/plus` | 788,9 | 769,0 | -2,5 % | 249,1 | 243,2 | -2,4 % |
| `/reglages` | 815,0 | 795,1 | -2,4 % | 255,3 | 249,4 | -2,3 % |
| `/revue` | 831,0 | 831,2 | 0,0 % | 263,7 | 263,6 | -0,0 % |
| `/scanner` | 926,9 | 908,9 | -1,9 % | 295,2 | 290,0 | -1,8 % |
| `/opinions` | 864,0 | 864,2 | 0,0 % | 272,9 | 272,4 | -0,2 % |
| `/vider-ma-tete` | 833,8 | 813,9 | -2,4 % | 263,6 | 257,7 | -2,2 % |

`/scanner` : l'écart inclut +1,9 Ko bruts venus du travail Scanner de la
soirée (#249, #250) ; l'effet propre de #254 y est de −19,9 Ko bruts.

### LCP et TBT

Deux paires de mesures, chacune prise sur une même machine. Le conteneur a
changé de machine pendant la nuit, donc les valeurs absolues de temps CPU ne se
comparent pas d'une paire à l'autre. Une première série finale, prise pendant
que la machine était chargée, donnait un TBT et un bootup gonflés. Elle a été
refaite : c'est celle du tableau.

**Lighthouse mobile, simulé (Lantern), même machine, baseline 6484c0e → final** (médiane de 3 runs)

| Route | Perf | LCP avant | LCP après | TBT avant | TBT après | Bootup JS avant | après |
|---|---|---|---|---|---|---|---|
| `/` | 77 → 95 | 4,46 s | 0,91 s | 323 ms | 265 ms | 1610 ms | 1639 ms |
| `/agenda` | 72 → 96 | 4,22 s | 0,91 s | 520 ms | 226 ms | 1754 ms | 1836 ms |
| `/aujourdhui` | 76 → 95 | 4,45 s | 0,91 s | 367 ms | 251 ms | 1612 ms | 1700 ms |
| `/courses` | 82 → 82 | 4,05 s | 4,58 s | 256 ms | 160 ms | 1394 ms | 1350 ms |
| `/habitudes` | 79 → 99 | 4,51 s | 0,91 s | 265 ms | 122 ms | 1350 ms | 1319 ms |
| `/notes` | 81 → 79 | 4,05 s | 4,74 s | 284 ms | 225 ms | 1416 ms | 1641 ms |
| `/nutrition/journal` | 83 → 97 | 4,07 s | 0,91 s | 237 ms | 205 ms | 1615 ms | 1705 ms |
| `/taches` | 76 → 77 | 4,14 s | 4,91 s | 430 ms | 269 ms | 1818 ms | 1670 ms |

**Lighthouse mobile, throttling réel (`--throttling-method=devtools`),
première machine, baseline → lot A (#252)** (médiane de 2 runs ; #253 et
#254 ne changent pas le rendu, seulement −5,9 Ko de JS sur une partie des
routes)

| Route | Perf | LCP avant | LCP après | TBT avant | TBT après | Bootup JS avant | après |
|---|---|---|---|---|---|---|---|
| `/` | 67 → 97 | 4,96 s | 1,63 s | 539 ms | 177 ms | 1152 ms | 1075 ms |
| `/courses` | 80 → 82 | 4,46 s | 4,38 s | 225 ms | 169 ms | 980 ms | 1019 ms |
| `/habitudes` | 69 → 90 | 4,82 s | 3,04 s | 829 ms | 161 ms | 1384 ms | 961 ms |
| `/notes` | 79 → 96 | 4,56 s | 1,58 s | 225 ms | 205 ms | 1015 ms | 1052 ms |
| `/nutrition/journal` | 70 → 97 | 4,64 s | 1,70 s | 461 ms | 176 ms | 1174 ms | 1096 ms |
| `/taches` | 77 → 81 | 4,73 s | 4,76 s | 256 ms | 143 ms | 1171 ms | 1152 ms |

État final en throttling réel, sur la nouvelle machine (médiane ×2) : LCP `/`
1,68 s, `/nutrition/journal` 1,66 s, `/notes` 1,87 s, `/habitudes` 1,90 s,
`/courses` 4,41 s, `/taches` 4,74 s.

Lecture des deux tableaux :

- en **simulé** (Lantern, l'estimation par défaut de Lighthouse), `/courses`,
  `/notes` et `/taches` semblent se dégrader. Leur élément LCP est du contenu
  qui dépend des données, et l'estimation compte désormais l'hydratation de la
  coquille, qui a lieu avant l'arrivée des données. Le LCP **observé** (sans
  throttling) est inchangé, autour de 0,5 s ;
- en **throttling réel** (`--throttling-method=devtools`), aucune route ne
  régresse. C'est la mesure la plus fidèle à un téléphone ;
- **fluidité** : le TBT baisse sur toutes les routes des deux tableaux. Le
  temps total d'exécution JS (bootup) reste neutre : ±200 ms selon la route,
  du même ordre que l'écart entre deux séries.
  L'hydratation de la coquille, désormais rendue par le serveur, ne coûte donc
  pas plus que l'ancien rendu client.

## Lots fusionnés

| PR | Changement | Gain mesuré |
|---|---|---|
| [#251](https://github.com/vincenthassanaly-source/Kilio/pull/251) | `hrefJourJournal` sort de `journal/jour.ts` (qui importe `next/server`) vers `liens.ts`. Deux composants client embarquaient tout `next/server` (CommonJS, impossible à élaguer). Garde-fou vitest `src/app/frontiere-client-serveur.test.ts` : aucun module client ne doit atteindre `next/server`, `next/cache` ni `next/headers`. | Journal : 880,3 → 794,5 Ko bruts, 273,8 → 250,1 Ko gzip ; bootup JS 1311 → 1159 ms |
| [#252](https://github.com/vincenthassanaly-source/Kilio/pull/252) | `<SeanceFlottante />` dans sa propre `<Suspense fallback={null}>` : la frontière du layout `(app)` n'est plus dynamique, barre du bas et pages reviennent dans le HTML statique. Garde-fou `e2e/coquille-serveur.spec.ts` (sans JS : titre et barre visibles ; avec JS : aucune erreur React #418/#419/#423/#425), qui échouait 31 fois sur 34 avant. Fixture `reglages_briefing` du faux Supabase complétée (colonnes ajoutées au schéma depuis). | LCP simulé 4,0-4,4 s → 0,91 s sur 5 routes ; titre peint à 30-60 ms au lieu de 180-890 ms ; plus d'erreur #419 |
| [#253](https://github.com/vincenthassanaly-source/Kilio/pull/253) | 10 routes de plus gardées par `instant()` et la coquille serveur (`/nutrition`, Menus, Bilan, Revue, Scanner, Opinions, Historique et Statistiques de musculation, Catégories, Révision). `/documents/categories` : la lecture passe sous `<Suspense>`, son vrai titre entre dans la coquille (avant : « Documents », celui du `loading.tsx` parent). | Coquille correcte pour Catégories ; 60 tests de garde en plus (rig 278/278) |
| [#254](https://github.com/vincenthassanaly-source/Kilio/pull/254) | `toISODate` réécrite sans date-fns : `lib/date/iso.ts`, atteint par le layout (VidageSync, SeanceFlottante), tirait `format` et la locale anglaise de date-fns dans le JS partagé. Test d'équivalence stricte avec `format(date, "yyyy-MM-dd")`. | −19,9 Ko bruts / −5,9 Ko gzip sur 16 routes |

Chaque lot : lint, typecheck, vitest, rig e2e complet et build verts. Les
revues (`react-reviewer`, `typescript-reviewer`, `security-reviewer`) n'ont
trouvé aucun bug. Les remarques retenues sont corrigées dans les PR.

## Lots étudiés puis abandonnés

### framer-motion avec `LazyMotion` et `m`

Étudié dans le code de framer-motion 13.2.0. Non livré : chaque variante
change quelque chose à l'écran.

- **`domAnimation` seul** (≈ −8 à −13 Ko gzip) perd `layout` et `layoutId`,
  donc des animations visibles : la pastille de l'onglet actif de la barre du
  bas, `SegmentedControl`, `NutritionSubNav`, `OngletsPharmacie`, l'Agenda, et
  le glissement des listes (tâches, courses, notes, habitudes, documents,
  objectifs, Journal).
- **`domMax` synchrone** = la même taille que `motion` (`domMax` =
  `domAnimation` + drag + layout) : aucun gain.
- **`domAnimation` synchrone + `layout` chargé après l'hydratation** : un
  nœud de projection créé après le montage d'un élément n'est jamais monté.
  `projection.mount()` n'est appelé que dans `VisualElement.mount`, au
  rattachement du DOM. La première animation de layout de chaque élément déjà
  affiché sauterait donc au lieu de glisser : pastille de la barre du bas au
  premier changement d'onglet, listes à la première suppression.
- **Tout en asynchrone** (≈ −34 Ko gzip) : les éléments avec `initial`
  restent invisibles jusqu'au chargement, et le rapport du 2026-09-30 avait
  mesuré un TBT dégradé.
- `drag` et `pan` (≈ 3-4 Ko gzip) ne servent nulle part, mais l'API publique
  ne permet pas de composer « animations + layout sans drag ». `loadFeatures`
  n'est pas exporté, et l'`exports` du paquet interdit les imports profonds.

### @dnd-kit dans le layout (15,6 Ko gzip sur toutes les pages)

Le `DndContext` de `NavigationEditProvider` enveloppe toute l'app :
`TabSwipeWrapper`, la page, `BottomNav`, `BackNavigationHandler`. Il ne sert
qu'au glisser-déposer depuis `/plus`. Le charger plus tard, ou seulement sur
`/plus`, change le type de l'élément à cette position : React remonterait tout
le sous-arbre. L'état de la page et le défilement seraient perdus, et
`BackNavigationHandler` réinstallerait sa garde d'historique. Le mode édition
ne peut pas non plus servir de déclencheur : c'est l'appui long détecté par
dnd-kit qui l'ouvre. Non tenté. Une refonte (zones de dépôt hors du contexte)
serait un changement de comportement.

### Non tentés, gain trop faible ou risque hors ligne

- Séparer `SeanceFlottante` en une porte légère et une barre chargée à la
  demande (≈ 4 Ko gzip). Le service worker ne met en cache un chunk qu'au
  premier téléchargement : hors ligne, en salle de sport, la barre de séance
  pourrait ne jamais apparaître.
- Différer `SpeedInsights` (≤ 2 Ko gzip) : la collecte des Web Vitals
  commencerait plus tard.

## Migrations

Aucune. Pas de requête lente identifiée cette nuit : sur le faux Supabase, le
temps est dominé par la latence simulée, et le rapport du 2026-10-04 concluait
déjà qu'aucun index ne manquait (tables de moins de 1 000 lignes). Aucune
branche Supabase créée, rien appliqué en production.

## À valider ou à faire ensuite

1. **LCP de `/courses` et `/taches`** (≈ 4,4-4,8 s en throttling réel).
   `connection()` en tête de page envoie toute la vue derrière `loading.tsx`.
   L'élément LCP (champ « Rechercher une tâche… », texte d'état vide) n'arrive
   qu'avec les données. Deux pistes :
   - mettre en cache `getTags` (dernière lecture non cachée de `/taches` et
     `/agenda`, patron de `src/lib/taches/cache.ts`, à invalider dans
     `createTag`, `deleteTag`, `resolveTagIds`, `notes.ts` et
     `notes-assistant.ts`) : les données arriveraient sans aller-retour
     Supabase ;
   - sortir l'en-tête et la recherche de la vue pour qu'ils soient dans la
     coquille. Cela touche `TasksList.tsx` et `TachesView`, hors périmètre de
     cette nuit.
2. **`TasksList.tsx`** (monolithe, hors périmètre) : `useSortable` est appelé
   même hors réordonnancement, ce qui garde @dnd-kit/sortable dans les routes
   Tâches et Agenda. Le découpage permettrait de le différer.
3. **date-fns `format`** reste dans les routes `/`, Tâches, Agenda,
   Habitudes, Aujourd'hui, Revue, Opinions, via `taches/compute.ts`, les vues
   de l'Agenda et `HistoriqueView`. Remplacer les formats simples
   (`yyyy-MM-dd`) par `toISODate` étendrait le gain de #254. Les formats avec
   locale française doivent garder date-fns.
4. **Accueil (`/`)** : son contenu, volumineux et sans `loading.tsx`, est émis
   par React en segment révélé par script (`$RC`). Il s'affiche dès la
   première image avec JS (LCP = FCP), mais pas sans JS. Sans enjeu pour une
   PWA, mais à savoir.
5. **Banc de test** : déjà au départ, deux défauts faisaient échouer la CI sans
   lien avec le code de l'app.
   - **Heure** : `aujourdhui.spec.ts:26` et `parite.spec.ts:59` échouent quand
     ils tournent entre 23 h et minuit UTC. Le faux Supabase date « aujourd'hui »
     en UTC, l'app à l'heure de Paris. Correctif proposé : dater les fixtures
     avec `aujourdhuiParis()`.
   - **Google Fonts** : le job `e2e` de `kiliomain` (runs #429 et #431, vers
     23 h UTC) a échoué au build (`Can't resolve
     '@vercel/turbopack-next/internal/font/google/font'`). C'est un
     téléchargement de police raté, transitoire.
6. **Mesure sur la vraie base** : toutes les mesures utilisent le faux
   Supabase. Le rig alternatif (preview Vercel, `instant-nav.rig.md`) reste à
   brancher pour juger le LCP réel. Côté production, Speed Insights doit
   montrer la baisse du LCP après #252.

## Risques résiduels (à regarder en priorité)

1. **L'hydratation est désormais réelle sur toutes les pages.** Avant #252,
   le contenu était rendu côté client, donc un écart entre rendu serveur et
   client ne pouvait pas se voir. Vérifié cette nuit, sans aucune erreur
   d'hydratation, sur 23 routes, avec et sans « Réduire les animations ».
   Mais seulement avec les données du faux Supabase : des listes réelles non
   vides pourraient révéler un écart que le banc ne couvre pas. **À regarder
   au réveil** : ouvrir les principales pages sur le téléphone, et la console
   ou les logs Vercel, à la recherche de « Minified React error #418 ».
2. `/reglages` plantait côté client avec l'ancienne fixture du faux Supabase
   (`bilan_heure` absent). En base réelle, la colonne est `NOT NULL`, donc
   aucun effet en production. Un écart de schéma de ce genre sur une autre
   table produirait le même symptôme.
3. Le garde-fou de coquille (`e2e/coquille-serveur.spec.ts`) détecte les
   erreurs React minifiées : il ne vaut que sur un build de production, ce
   qu'est le rig.
4. Pendant la nuit, une autre session a fusionné des PR « Scanner » (#247 à
   #250). Elles ne touchent pas les mêmes fichiers. Les lots ont été rebasés
   avant fusion et la CI a tourné sur l'état combiné.
