# Mesure du LCP sur 24 routes — 2026-11-06

Mesure de l'état de `kiliomain` après #257 (commit `2d9ef61`, contenu identique
au squash `88a24d7`). Elle fait suite à `2026-11-04-baseline-performance.md`
et `2026-11-04-nuit-performance.md`, dont elle reprend la méthode. Aucun code
modifié.

## Résumé

- **#257 (tags en cache) fait passer le LCP de `/taches` de 4,65 s à 0,92 s**
  (Lighthouse mobile simulé, médiane de 3 runs, avant 4612 / 4651 / 4699 ms,
  après 920 / 915 / 913 ms). Le score de performance passe de 76 à 94.
  `/agenda` et `/courses` étaient déjà à 0,91 s et ne bougent pas.
- **Sur 24 routes, 18 ont un LCP simulé sous 2,5 s.** Les 6 autres affichent
  4,5 à 5,8 s en simulation : `/opinions`, `/vider-ma-tete`, `/nutrition/menus`,
  `/reglages`, `/nutrition/bilan`, `/musculation`.
- **En throttling réel, 4 de ces 6 routes sont à environ 1,9 s**, comme les
  routes saines. Leur retard simulé est un artefact de la mesure (voir plus bas).
  **Seules `/opinions` (5,4 s) et `/vider-ma-tete` (5,0 s) sont réellement
  lentes.**
- Le JS de première charge est inchangé par #257 (écart de ±0,1 Ko avec le
  rapport du 2026-11-04 sur les 24 routes) : 238 à 290 Ko gzip selon la route.

## Méthode

Identique à la baseline du 2026-11-04 pour que les chiffres se comparent.

- Build de production avec `E2E_SUPABASE_URL=http://localhost:54321` puis
  `next start --port 3200`, contre le faux Supabase du rig
  (`e2e/mock-supabase.mjs`, latence 400 ms), remis à zéro avant chaque run.
- Lighthouse 13.6.0, catégorie performance, preset mobile par défaut
  (throttling simulé « Lantern »), 3 runs par route, médiane.
  Chaque route est chargée une fois avant les runs pour remplir le cache
  serveur (`"use cache"`).
- Contrôle en throttling réel (`--throttling-method=devtools`) pour les
  6 routes lentes en simulation et 2 témoins (`/taches`, `/courses`).
- JS de première charge : tous les chunks `/_next/static/chunks/*.js`
  référencés par le HTML de la route, polyfill `noModule` exclu, gzip niveau 6.
- Machine : conteneur de session, Chromium 153. Les valeurs absolues dépendent
  de la machine ; les comparaisons dans ce rapport sont faites sur la même.

## Effet de #257 sur `/taches`

| Route | LCP avant #257 (#256) | LCP après #257 | Perf | TBT |
|---|---|---|---|---|
| `/taches` | 4651 ms (4612, 4651, 4699) | 915 ms (920, 915, 913) | 76 → 94 | 317 → 280 ms |
| `/agenda` | 915 ms | 911 ms | 92 → 94 | 328 → 270 ms |
| `/courses` | 914 ms | 913 ms | 96 → 97 | 217 → 186 ms |

Mesure « avant » faite sur un second répertoire de travail git (`git worktree`)
au commit `966ee11`, même protocole. Cause probable du gain : `getTags` était la
dernière lecture non cachée du préchargement de `/taches` ; ce n'est pas
démontré par une mesure intermédiaire.

La mesure en throttling réel n'a pas été faite avant #257. Après #257,
`/taches` est à 1,93 s en throttling réel, au niveau des routes saines ; le
rapport du 2026-11-04 donnait 4,74 s pour `/taches` dans ce mode, sur une
autre session, donc à titre indicatif seulement.

## Les 24 routes (Lighthouse mobile simulé, médiane de 3)

| Route | Perf | LCP simulé (s) | LCP des 3 runs (ms) | FCP (s) | TBT (ms) | JS gzip (Ko) |
|---|---|---|---|---|---|---|
| `/opinions` | 73 | 5,78 | 5759, 5812, 5775 | 0,91 | 266 | 272,4 |
| `/vider-ma-tete` | 80 | 4,64 | 4688, 4455, 4639 | 0,91 | 206 | 257,7 |
| `/nutrition/menus` | 80 | 4,54 | 912, 4549, 4543 | 0,91 | 222 | 246,1 |
| `/reglages` | 79 | 4,52 | 4773, 4466, 4521 | 0,91 | 262 | 249,5 |
| `/nutrition/bilan` | 82 | 4,49 | 4472, 4502, 4485 | 0,91 | 182 | 245,8 |
| `/musculation` | 81 | 4,47 | 4472, 4646, 4310 | 0,91 | 192 | 248,5 |
| `/taches` | 88 | 0,92 | 924, 4592, 913 | 0,91 | 383 | 280,7 |
| `/` | 84 | 0,92 | 924, 915, 911 | 0,92 | 617 | 275,2 |
| `/nutrition` | 97 | 0,91 | 913, 914, 1967 | 0,91 | 201 | 238,4 |
| `/habitudes` | 94 | 0,91 | 913, 910, 914 | 0,91 | 289 | 260,8 |
| `/aujourdhui` | 94 | 0,91 | 913, 912, 911 | 0,91 | 276 | 286,5 |
| `/nutrition/journal` | 98 | 0,91 | 912, 910, 912 | 0,91 | 163 | 244,3 |
| `/nutrition/recettes` | 100 | 0,91 | 912, 910, 912 | 0,91 | 85 | 245,7 |
| `/taches/listes` | 99 | 0,91 | 913, 912, 909 | 0,91 | 138 | 253,4 |
| `/collection` | 97 | 0,91 | 911, 911, 908 | 0,91 | 190 | 259,6 |
| `/objectifs` | 97 | 0,91 | 910, 913, 911 | 0,91 | 181 | 251,5 |
| `/pharmacie` | 93 | 0,91 | 912, 906, 911 | 0,91 | 303 | 255,6 |
| `/plus` | 94 | 0,91 | 912, 910, 911 | 0,91 | 290 | 243,2 |
| `/agenda` | 93 | 0,91 | 911, 910, 908 | 0,91 | 321 | 283,3 |
| `/courses` | 96 | 0,91 | 910, 909, 912 | 0,91 | 224 | 253,7 |
| `/scanner` | 99 | 0,91 | 910, 909, 911 | 0,91 | 114 | 290,0 |
| `/documents` | 97 | 0,91 | 911, 907, 909 | 0,91 | 198 | 257,6 |
| `/notes` | 96 | 0,91 | 910, 909, 909 | 0,91 | 244 | 253,6 |
| `/revue` | 98 | 0,91 | 910, 908, 908 | 0,91 | 164 | 263,6 |

Le FCP est à 0,91 s partout : la coquille serveur arrive vite sur toutes les
routes. Les écarts de LCP viennent donc de ce qui s'affiche après.

Runs isolés à signaler : `/taches` (4592 ms sur un run sur trois, les deux
autres à 913-924 ms) et `/nutrition` (1967 ms sur un run). Je n'ai pas
d'explication établie ; une piste est l'expiration des 60 s de `revalidate` du
cache entre deux runs, qui force une relecture, mais elle n'a pas été vérifiée.

## Les routes lentes en simulation : simulé contre réel

| Route | LCP réel (s) | 3 runs (ms) | LCP simulé (s) | Perf réel | TBT (ms) |
|---|---|---|---|---|---|
| `/opinions` | 5,38 | 5481, 5318, 5385 | 5,78 | 75 | 224 |
| `/vider-ma-tete` | 5,03 | 5023, 5034, 5095 | 4,64 | 77 | 186 |
| `/nutrition/bilan` | 1,98 | 1980, 1976, 1990 | 4,49 | 95 | 206 |
| `/reglages` | 1,94 | 1905, 1940, 1952 | 4,52 | 94 | 255 |
| `/nutrition/menus` | 1,93 | 1679, 1935, 1928 | 4,54 | 95 | 231 |
| `/taches` (témoin) | 1,93 | 1927, 1914, 1952 | 0,92 | 96 | 195 |
| `/musculation` | 1,91 | 1948, 1907, 1911 | 4,47 | 86 | 180 |
| `/courses` (témoin) | 1,89 | 1878, 1887, 1886 | 0,91 | 95 | 225 |

En throttling réel, le plancher est d'environ 1,9 s sur toutes les routes
(FCP à 1,6 s, réseau bridé). Quatre routes que la simulation donnait à 4,5 s
sont à ce plancher. Dans le rapport simulé, le LCP saute entre 0,9 s et 4,5 s
selon que l'élément mesuré est le titre `<h1>` ou un texte apparu plus tard
(par exemple `/nutrition/menus` : « Menus » sur un run, « Copier la semaine
précédente » sur les deux autres). **Le LCP simulé de ces routes dépend donc de
l'élément retenu et sert mal à les comparer ; le throttling réel est plus
fiable pour elles.**

## Les deux routes réellement lentes

### `/opinions` (5,4 s réel)

L'élément LCP est le texte d'état vide « Aucune idée pour l'instant… ». La page
ne précharge rien côté serveur : `OpinionsView` appelle
`useQuery({ queryKey: queryKeys.opinions, queryFn: getIdees })` dans le
navigateur, après l'hydratation. Le contenu attend donc le JS, l'hydratation,
puis un aller-retour serveur. Les routes saines (`/taches`, `/courses`,
`/agenda`) préchargent côté serveur avec `HydrationBoundary` et des lectures
`"use cache"`. Piste : appliquer le même patron à `/opinions`.

### `/vider-ma-tete` (5,0 s réel)

L'élément LCP est le message de l'écran de verrou. C'est voulu :
`VerrouGate` n'affiche rien, pas même un titre, tant que la session n'est pas
ouverte, et il lit l'état du verrou côté client (`etatVerrou()`) après
l'hydratation. Ce délai est la conséquence d'un choix de sécurité ; le réduire
changerait ce comportement et n'est pas une simple optimisation. À décider avec
toi avant toute modification. Dans le rig, la variable
`E2E_VERROU_DESACTIVE=1` modifie aussi l'écran affiché, donc cette mesure ne
reflète pas exactement le parcours réel.

## Limites

- **Faux Supabase.** Toutes les mesures utilisent le faux Supabase (latence
  400 ms, données légères). Sur la vraie base, les valeurs absolues
  changeront. Speed Insights sur le déploiement reste la vérification à faire.
- **Cache chaud.** Chaque route est chargée une fois avant les runs. La
  première visite après une expiration du cache (60 s de `revalidate`) relit
  Supabase et est plus lente ; ce cas n'est pas mesuré.
- **Trois runs par route** : la médiane est stable pour la plupart, mais deux
  routes ont un run isolé très différent (voir plus haut).
- **Pas de comparaison avant/après #257 en throttling réel.**
- **Pages derrière connexion** : sans compte de test, la mesure passe par le
  rig, pas par la vraie authentification.

## À faire ensuite

1. **`/opinions` : précharger les idées côté serveur** (`HydrationBoundary`,
   lecture en cache). Gain attendu : LCP réel proche de 1,9 s comme les
   routes saines. Non mesuré avant implémentation.
2. **`/vider-ma-tete`** : décision à prendre sur le verrou (voir plus haut).
3. **Vérifier en production** avec Speed Insights le LCP de `/taches` après
   #257, et l'absence d'erreur d'hydratation (« Minified React error #418 ») sur
   les principales pages, ce que le rapport du 2026-11-04 recommandait déjà.
4. Abandonné après examen : différer `@dnd-kit/sortable` (lot C). Gain
   d'environ 4,7 Ko gzip sur une seule route (`/agenda`) pour un découpage de
   `TaskCard` à risque ; la page `/taches` en a besoin dès l'affichage.
