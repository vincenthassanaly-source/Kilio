# Navigation instantanée (Cache Components) — 2026-09-24

> Note : les captures d'écran citées dans ce rapport ont été supprimées du dépôt (nettoyage d'octobre 2026) ; elles restent récupérables dans l'historique git.

## 1. Résumé

Avant cette session, **aucune page de Kilio ne pouvait s'afficher avant que le
serveur ait fini deux lectures** : le cookie de thème (layout racine) et les
préférences de la barre du bas (lecture Supabase dans le layout `(app)`). À
l'ouverture de l'app, ou au rechargement de n'importe quelle page, l'écran
restait donc vide le temps de ces allers-retours, même pour Tâches, Courses ou
Notes dont les données se chargent de toute façon côté client.

Désormais :

- **Ouvrir n'importe quel module** (chargement initial ou retour dans la PWA)
  affiche instantanément le titre, la barre du bas dans l'ordre personnalisé,
  le bouton de thème et les skeletons ; seules les données arrivent ensuite.
  Tâches, Courses, Agenda, Objectifs, Collection, Plus et le hub Nutrition sont
  même entièrement pré-générés : la page complète est servie depuis le CDN.
- **L'accueil** affiche immédiatement la barre de recherche et les silhouettes
  des cartes ; la date, la salutation et chaque carte (nutrition, tâches du
  jour, habitudes) arrivent chacune dès que sa requête est prête. Avant, un
  clic sur « Accueil » dans la barre du bas n'affichait rien tant que le
  serveur n'avait pas répondu.
- **Changer l'ordre de la barre du bas ou de la grille Plus** reste visible
  immédiatement et au rechargement.
- Aucun changement de contenu, d'états vides, de mise à jour optimiste
  (cocher une tâche depuis l'accueil met toujours Tâches à jour), de thème, de
  service worker ni de rafraîchissement au retour au premier plan.

Captures sous verrou `instant()` (ce que l'utilisateur voit au premier instant,
avant toute donnée dynamique), mobile 390 px :

| Route | Avant | Après |
|---|---|---|
| `/` | [avant](captures-2026-09-24-navigation-instantanee/avant-mobile-accueil.png) | [après](captures-2026-09-24-navigation-instantanee/apres-mobile-accueil.png) |
| `/taches` | [avant](captures-2026-09-24-navigation-instantanee/avant-mobile-taches.png) | [après](captures-2026-09-24-navigation-instantanee/apres-mobile-taches.png) |
| `/nutrition/journal` | [avant](captures-2026-09-24-navigation-instantanee/avant-mobile-nutrition-journal.png) | [après](captures-2026-09-24-navigation-instantanee/apres-mobile-nutrition-journal.png) |
| `/habitudes` | [avant](captures-2026-09-24-navigation-instantanee/avant-mobile-habitudes.png) | [après](captures-2026-09-24-navigation-instantanee/apres-mobile-habitudes.png) |
| `/budget` | [avant](captures-2026-09-24-navigation-instantanee/avant-mobile-budget.png) | [après](captures-2026-09-24-navigation-instantanee/apres-mobile-budget.png) |

Les mêmes captures existent en 1280 px (`*-desktop-*.png`). « Avant » affiche
le message de Next.js « you attempted to load a blocking route » : la route ne
peut rien montrer tant que le serveur n'a pas fini.

## 2. Audit des routes et résultat

Type : **client** = shell serveur + données TanStack Query ; **serveur** =
Server Component qui lit Supabase. « Globaux » = cookie de thème + préférences
de navigation, communs à toutes les routes avant correction.

| Route | Type | Lectures bloquantes identifiées | `loading.tsx` | Potentiel de coquille | Dépend de l'URL | Difficulté | Résultat |
|---|---|---|---|---|---|---|---|
| `/` | serveur (cartes async + prefetch TanStack) | globaux ; `new Date()` (date du jour, salutation) dans la page | non | fort : recherche, structure, skeletons des cartes | non | moyenne | **optimisée** — date du jour sous `<Suspense>` |
| `/taches` | client | globaux | oui | page entière (statique ○) | non | faible | **optimisée** (globaux) |
| `/taches/listes` | serveur | globaux ; listes, tags, compteurs | oui | titre + skeletons (`loading.tsx`) | non | faible | **optimisée** (globaux) |
| `/nutrition/journal` | serveur | globaux ; `searchParams` (date, jour) ; objectif + repas | oui | titre + skeletons (`loading.tsx`) | oui (`?date`, `?jour`) | moyenne | **optimisée** (globaux) ; navigation par date : candidate Partial Prefetching |
| `/habitudes` | client + date serveur | globaux ; `new Date()` dans la page | oui | titre + skeletons | non | faible | **optimisée** — date du jour sous `<Suspense>` |
| `/courses` | client | globaux | oui | page entière (○) | non | faible | **optimisée** (globaux) |
| `/notes` | client | globaux ; `searchParams` (`?action=new`) | oui | titre + skeletons (`loading.tsx`) | oui (paramètre d'ouverture) | faible | **optimisée** (globaux) |
| `/agenda` | client | globaux ; `useSearchParams` (AgendaView) | oui | page entière (○), vue sous `loading.tsx` | oui (vue/date) | faible | **optimisée** (globaux) |
| `/budget` | serveur | globaux ; mois courant (`new Date()`), génération des récurrences, comptes/résumé | oui | titre + skeletons (`loading.tsx`) | non | faible | **optimisée** (globaux) |
| `/budget/transactions` | serveur | globaux ; `searchParams` (filtres) ; données | oui | titre + skeletons | oui | faible | **optimisée** ; candidate Partial Prefetching (filtres) |
| `/budget/comptes` | serveur | globaux ; comptes | oui | titre + skeletons | non | faible | **optimisée** (globaux) |
| `/budget/categories` | serveur | globaux ; `searchParams` (période) | oui | titre + skeletons | oui | faible | **optimisée** ; candidate Partial Prefetching |
| `/budget/statistiques` | serveur | globaux ; `searchParams` (période) | oui | titre + skeletons | oui | faible | **optimisée** ; candidate Partial Prefetching |
| `/budget/recurrentes` | serveur | globaux ; données | oui | titre + skeletons | non | faible | **optimisée** (globaux) |
| `/budget/calendrier` | serveur | globaux ; `searchParams` (mois) | oui | titre + skeletons | oui | faible | **optimisée** ; candidate Partial Prefetching |
| `/nutrition/recettes` | serveur | globaux ; recettes | oui | titre + skeletons | non | faible | **optimisée** (globaux) |
| `/nutrition/recettes/[id]` | serveur | globaux ; `params` + recette, `notFound()` | oui | aucune hors skeleton : tout dépend de l'id | oui | — | navigation client instantanée (`loading.tsx`) ; **candidate Partial Prefetching** ; non gardée par un test |
| `/objectifs` | client | globaux | oui | page entière (○) | non | faible | **optimisée** (globaux) |
| `/objectifs/[id]` | client (`use(params)`) | globaux ; `usePathname()` du layout `(app)` | oui | aucune hors skeleton | oui | — | idem : **candidate Partial Prefetching** |
| `/documents` | serveur | globaux ; documents + étiquettes | oui | titre + skeletons | non | faible | **optimisée** (globaux) |
| `/documents/[id]` | serveur | globaux ; `params`, `notFound()` | oui | aucune hors skeleton | oui | — | **candidate Partial Prefetching** |
| `/collection` | client | globaux | oui | page entière (○) | non | faible | **optimisée** (globaux) |
| `/collection/[id]` | client (`use(params)`) | globaux ; `usePathname()` du layout `(app)` | oui | aucune hors skeleton | oui | — | **candidate Partial Prefetching** |
| `/plus` | client (grille = préférences) | globaux | oui | page entière (○) | non | faible | **optimisée** (globaux) |
| `/reglages` | serveur | globaux ; réglages de nettoyage | oui | titre + skeletons | non | faible | **optimisée** (globaux) |

Hors liste (registre des modules) : `/carburants` et le hub `/nutrition` sont
statiques (○) ; `/documents/etiquettes` et `/collection/partage/choisir`
(cible de partage PWA, hors `(app)`) passent en prérendu partiel via leur
`loading.tsx`, sans test dédié.

**Aucun `export const instant = false` ne subsiste** : les 29 opt-outs posés
par le codemod ont tous été retirés et le build passe.

## 3. Navigations optimisées (une ligne par navigation guardée)

Chaque ligne est couverte par `e2e/instant-navigation.spec.ts`, en 1280 px et
390 px.

**Chargement initial** (`page.goto` sous `instant()`) :

| Route | Instantané | En streaming |
|---|---|---|
| `/` | barre du bas, recherche, silhouettes de l'en-tête et des cartes, bouton + | date, salutation, carte nutrition, tâches du jour / prochain événement, habitudes |
| `/taches`, `/courses`, `/objectifs`, `/collection`, `/plus` | page complète pré-générée (titre, filtres, formulaires, barre du bas) | données TanStack Query (inchangé) |
| `/agenda` | titre, barre du bas, skeleton de la vue | vue (après lecture de l'URL côté client) puis données |
| `/habitudes` | titre, barre du bas, skeletons | vue du jour (date serveur) puis habitudes |
| `/nutrition/journal`, `/notes`, `/taches/listes`, `/budget` et ses 6 sous-pages, `/nutrition/recettes`, `/documents`, `/reglages` | titre, barre du bas, skeletons du `loading.tsx` existant | contenu de la page (lectures Supabase, paramètres d'URL) |

**Navigation client** (clic réel sous `instant()`) : `/plus → /`,
`/plus → /taches`, `/plus → /agenda`, `/plus → /notes` (barre du bas),
`/taches → /plus`, `/plus → /habitudes | /courses | /budget | /objectifs |
/collection | /documents | /reglages` (grille Plus),
`/nutrition/recettes ↔ /nutrition/journal`, `/taches → /taches/listes`,
`/budget → transactions | comptes | categories | statistiques | recurrentes |
calendrier`. Dans tous les cas, le titre de la destination et la barre du bas
s'affichent au clic ; `/` et `/habitudes` ont en plus une vérification
auto-validante : le contenu du jour est absent sous verrou, puis arrive.

## 4. Choix sur le thème et les préférences de navigation

**Thème — le script inline seul applique la classe `dark`.** Le layout racine
ne lit plus `cookies()`. `themeInitScript` (déjà présent, synchrone, dans
`<head>`) lit désormais lui-même le cookie `kilio-theme`, qui n'est pas
`httpOnly` puisqu'il est posé par `ThemeToggle`, avec la même priorité
qu'avant : cookie > localStorage > préférence système. **Pas de flash
possible** : un script synchrone du `<head>` s'exécute avant que le parseur
n'atteigne `<body>`, donc avant tout rendu. C'est pourquoi je ne vous ai pas
posé la question prévue en cas de risque de flash. Vérifié par
`e2e/parite.spec.ts` : la classe est relevée à l'insertion de `<body>` dans
les 4 cas (cookie sombre, cookie clair malgré un système sombre, localStorage
seul, système seul). Seule différence théorique : avec JavaScript désactivé,
le thème sombre ne s'appliquerait plus, ce qui est sans objet pour la PWA.

**Préférences de navigation — cache plutôt que `<Suspense>`.** La ligne réelle
(vérifiée via Supabase MCP) a une barre du bas personnalisée (`/`, `/agenda`,
`/taches`, `/notes`) différente de l'ordre par défaut (`/`, `/nutrition`,
`/taches`, `/habitudes`). Un report sous `<Suspense>` avec l'ordre par défaut
en fallback aurait donc provoqué un réordonnancement visible de la barre à
chaque chargement. Le cache (`"use cache"`) met l'ordre personnalisé
directement dans la coquille statique : aucun changement visible, donc pas de
question nécessaire.

Conséquence liée : `NavigationEditProvider`, `TabSwipeWrapper` et `BottomNav`
lisent `usePathname()`, inconnu au build pour les routes `[id]`. Une frontière
`<Suspense fallback={null}>` a été ajoutée dans le layout `(app)` autour de
ces trois composants. Elle ne s'active qu'au chargement initial des routes
`[id]` : partout ailleurs, le chemin est connu au prérendu et tout reste dans
la coquille. Sur ces routes, le premier affichage est le fond de l'app avec le
bouton de thème, puis le contenu, au lieu d'un écran bloqué.

## 5. Caches ajoutés et revalidation

| Cache | Où | Durée | Invalidation | Test de mutation |
|---|---|---|---|---|
| `getPreferencesNavigationResolues()` (`"use cache"`, tag `preferences-navigation`) | `src/lib/navigation/preferences.ts` | `cacheLife("days")` ; `cacheLife("minutes")` + ordre par défaut si Supabase est injoignable | `updateTag("preferences-navigation")` dans `updateOrdreGrillePlus` et `updateModulesBarreBasse`, en plus des `revalidatePath` existants (`/plus` ; `/`, `"layout"`) | `e2e/preferences-navigation.spec.ts` : épingler un module puis réordonner la grille, relecture dans un navigateur neuf sur `/taches`, `/notes` et `/plus`, puis retour à l'état initial |

- Le test de mutation est discriminant : sans aucune invalidation, il échoue.
  Constat honnête : chacun des `revalidatePath` d'origine suffit déjà à
  expirer ce cache (tags implicites de chemin). `updateTag` est gardé comme
  invalidation explicite, recommandée par la doc pour la lecture de ses
  propres écritures.
- **Aucune donnée métier n'a été mise en cache.** Journal, Budget, tâches,
  etc. restent lus à chaque requête : le bug de cache connu du Journal n'est
  pas répliqué. Les six `export const dynamic = "force-dynamic"` ont été
  retirés (inutiles sous Cache Components, où tout est dynamique par défaut),
  sans rien mettre en cache à leur place.
- Les caches TanStack Query sont inchangés. Parité vérifiée : cocher la tâche
  du jour sur l'accueil la montre faite sur `/taches` sans rechargement.

## 6. Hypothèses, écarts et suite

**Rig et données**

- **Supabase est injoignable depuis le sandbox** (proxy 403, pas de clé). La
  vérification a été faite sur un build de production local contre un faux
  Supabase (`e2e/mock-supabase.mjs`, latence 400 ms, données vides sauf les
  préférences réelles, une liste et une tâche du jour). La coquille ne dépend
  pas des données, mais **le rendu avec les vraies données n'a pas été revu**
  dans cette session. Un rig alternatif sur un preview deploy Vercel est
  décrit dans `instant-nav.rig.md`.
- La skill `next-dev-loop` n'a pas été utilisée. Les vérifications reposent
  sur le build de production (route par route) et sur Playwright, qui fait
  foi pour `instant()`.
- Incident de rig corrigé en cours de session : `lsof` ne voit pas le
  `next-server` dans ce sandbox, si bien que plusieurs exécutions
  intermédiaires ont mesuré un ancien build. Tous les résultats cités ici
  proviennent d'exécutions postérieures au correctif (`fuser`, refus de
  démarrer si le port est occupé).

**À vérifier au premier déploiement**

- **Builds Preview Vercel : ils échoueront tant que `SUPABASE_SERVICE_ROLE_KEY`
  n'est définie que pour Production** (état constaté via l'API Vercel). Les
  pages sont maintenant prérendues, et `createAdminClient()` refuse une clé
  absente dès le prérendu (« supabaseKey is required »). La branche `kilio`
  déploie en Production, où la clé existe. Une Pull Request (build Preview)
  demande d'abord d'ajouter la clé à l'environnement Preview.
- Hypothèse non vérifiée : les variables « sensitive » de Vercel sont
  disponibles pendant le build (comportement documenté). Le build Production
  lit en effet les préférences de navigation au prérendu. Si Supabase est
  injoignable à ce moment-là, le build passe quand même avec l'ordre par
  défaut, relu en quelques minutes à l'exécution.
- Hypothèse non vérifiée : Vercel ne transmet pas au navigateur le
  `s-maxage, stale-while-revalidate` des pages statiques. En local,
  `next start` le transmet et Chrome sert alors une fois l'ancienne version au
  premier rechargement après une mutation, tandis que le serveur est, lui,
  déjà à jour. À vérifier après déploiement : épingler un module, puis
  recharger.

**Écarts de comportement acceptés**

- Document ou recette introuvable : même page « 404 » à l'écran, mais code
  HTTP 200 au lieu de 404. La coquille est déjà envoyée quand `notFound()`
  s'exécute (streaming). Sans effet pour une PWA privée.
- Panne Supabase à l'exécution : avant, le layout levait une erreur sur toute
  l'app ; désormais la barre du bas s'affiche dans l'ordre par défaut et les
  pages gèrent leurs propres erreurs.
- `/habitudes` était déjà instantanée grâce à son `loading.tsx` dès la levée
  des blocages globaux (différentiel ci-dessous). Le changement de sa page
  sert à sortir `new Date()` du rendu, ce qu'impose le build, et donne une
  coquille pré-générée fidèle (vrai titre avec son `viewTransitionName`).

**Prochaines étapes**

- **Partial Prefetching** (non adopté, comme demandé : `rg` de la section
  « After optimization » sans résultat). Recommandé via la skill
  `next-partial-prefetching-adoption`. Routes candidates, dont le contenu
  dépend de l'URL : `/nutrition/recettes/[id]`, `/objectifs/[id]`,
  `/documents/[id]`, `/collection/[id]`, la navigation par date du Journal
  (`?date`, `?jour`), `/budget/transactions` (filtres), `/budget/categories`,
  `/budget/statistiques`, `/budget/calendrier` (période), `/agenda` (vue/date),
  `/notes?action=new`.
- Agrandir la coquille des pages serveur qui s'appuient sur leur
  `loading.tsx` : sortir le vrai en-tête du Journal (sous-navigation Nutrition
  et titre, qui ne dépendent pas de la date) et du Budget de la frontière de
  page, et pousser les `<Suspense>` au niveau de chaque lecture.
- View Transitions : aucune modification ; les transitions existantes
  (`useViewTransitionNavigate`, `viewTransitionName` des titres, fondus du
  Dashboard) fonctionnent avec les nouvelles frontières. Elles n'ont été
  vérifiées que par les tests de navigation, sans revue visuelle dédiée.
- `skills-lock.json` n'a pas été mis à jour : les deux skills ont été copiés
  depuis la copie synchronisée des skills Vercel (identique à
  `vercel/next.js`, dossier `skills/`), mais le `computedHash` ne peut pas
  être recalculé hors ligne.

## 7. Fichiers modifiés et vérifications

**Code applicatif**

- `next.config.ts` : `cacheComponents: true` ; `exposeTestingApiInProductionBuild`
  et l'URL Supabase du rig pilotés par `EXPOSE_TESTING_API` /
  `E2E_SUPABASE_URL` (jamais définis sur Vercel).
- `src/app/layout.tsx`, `src/lib/theme.ts`, `src/components/ThemeToggle.tsx` : thème.
- `src/app/(app)/layout.tsx`, `src/lib/navigation/preferences.ts` (nouveau),
  `src/app/actions/preferences-navigation.ts` : préférences en cache +
  `<Suspense>` autour des lecteurs de `usePathname()`.
- `src/app/(app)/page.tsx`, `src/app/(app)/today.ts` (nouveau),
  `DashboardView.tsx`, `Dashboard{Nutrition,Taches,Habitudes}Card.tsx`,
  `src/components/skeletons/DashboardSkeleton.tsx` (extraction de
  `DashboardHeaderSkeleton`) : accueil.
- `src/app/(app)/habitudes/page.tsx`, `loading.tsx`, `HabitudesSkeleton.tsx`
  (nouveau, extrait de `loading.tsx`) : habitudes.
- `agenda`, `nutrition/journal`, `budget` (+ `transactions`, `statistiques`,
  `calendrier`) : retrait de `force-dynamic` ; `budget/page.tsx` garde un
  `await connection()` justifié (mois courant, récurrences générées à chaque
  requête).

**Tests et outillage** : `playwright.config.ts`, `e2e/instant-navigation.spec.ts`,
`e2e/routes.ts`, `e2e/preferences-navigation.spec.ts`, `e2e/parite.spec.ts`,
`e2e/mock-supabase.mjs`, `e2e/run-instant-rig.sh` (`npm run test:instant`),
`instant-nav.rig.md`, `.claude/skills/next-cache-components-{adoption,optimizer}/`,
`package.json` (`@next/playwright@16.3.3`, `@playwright/test@1.56.1`, même
ligne de release que `next@16.3.3`), `.gitignore`.

**Commandes**

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | code 0, aucune erreur |
| `npm run lint` (`eslint`) | code 0, aucun avertissement |
| `SUPABASE_SERVICE_ROLE_KEY=<factice> npm run build` (Supabase injoignable) | code 0 ; repli journalisé « Préférences de navigation illisibles, ordre par défaut utilisé » |
| `npm run build` sans aucune clé | **échec** : « supabaseKey is required » au prérendu (cf. builds Preview, §6) |
| `e2e/run-instant-rig.sh` (build de production + toutes les suites) | 148 réussis : instant 88, mutation 4, parité 14, référence 42 (supprimée ensuite, phase G) |
| `e2e/run-instant-rig.sh --no-build e2e/instant-navigation.spec.ts --repeat-each=3` | 264/264 : déterministe |
| Même garde sur l'état d'avant (1a5ac4f : flag activé, tout en opt-out) | 46 échecs / 42 réussis : les 21 chargements initiaux ×2 largeurs + les 3 tests de `/` ×2 |

**Différentiels** (ne retirer que le correctif concerné, bureau 1280 px) :

| Correctif retiré | Résultat | Réappliqué |
|---|---|---|
| Thème (retour à `await cookies()` dans le layout racine) | 21 chargements initiaux RED | GREEN |
| Cache des préférences (lecture Supabase non cachée) | 21 chargements initiaux RED | GREEN |
| Date du jour de l'accueil (`await` en tête de page) | 3 tests de `/` RED | GREEN |
| Date du jour d'Habitudes | reste GREEN (couvert par son `loading.tsx`) | — |
| Invalidations des préférences (`updateTag` + `revalidatePath`) | test de mutation RED | GREEN |

Pour relancer : `npm run test:instant` (ou
`e2e/run-instant-rig.sh e2e/instant-navigation.spec.ts`), voir `instant-nav.rig.md`.
