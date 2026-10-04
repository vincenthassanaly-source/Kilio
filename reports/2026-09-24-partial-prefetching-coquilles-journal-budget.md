# Partial Prefetching et coquilles du Journal et du Budget (2026-09-24)

> Note : les captures d'écran citées dans ce rapport ont été supprimées du dépôt (nettoyage d'octobre 2026) ; elles restent récupérables dans l'historique git.

Branche : `kilio` (commits `18c4e5b` → `7c07844`, non poussés à la rédaction).
Skills appliqués : `next-partial-prefetching-adoption`, `next-dev-loop`,
`next-cache-components-optimizer`, `vercel-react-best-practices`,
`web-design-guidelines`. Rig : `instant-nav.rig.md` (mis à jour).

## 1. Résumé

- **Le Journal s'ouvre sur son vrai en-tête sans attente.** Taper sur
  « Journal », sur ‹ ou › ou sur Repos/Entraînement affiche tout de suite la
  sous-navigation Journal/Recettes, le titre, les boutons ‹ › et la bascule
  Repos/Entraînement. La date, l'objectif, le résumé et les repas du jour
  arrivent ensuite en streaming. Avant, tout l'écran était un skeleton gris
  jusqu'à la réponse de Supabase.
- **Même chose pour le Budget (vue d'ensemble et 6 sous-pages).** Les titres,
  les liens d'en-tête (Calendrier, Récurrentes, Liste), la carte « Autres
  vues », les boutons « Ajouter un compte » et « Ajouter une catégorie », le
  cadre des sélecteurs de période (Semaine/Mois/Année, ← Précédent/Suivant →)
  et la grille L M M J V S D du calendrier font partie de la coquille. Les
  montants, listes et libellés de période arrivent ensuite.
- **Partial Prefetching est activé** (`partialPrefetching: true`). Chaque lien
  précharge désormais une seule coquille partagée par route, au lieu d'un
  préchargement par lien. Kilio n'avait aucun `<Link prefetch={true}>` : rien
  de ce qui était préchargé avant n'est perdu (suite de préservation verte
  avant et après).
- **Pas de préchargement du contenu propre à chaque lien**, sur ta décision
  (App Shell seul pour les 4 groupes). Donc aucun cache de données ajouté : le
  Journal et le Budget restent lus en direct, y compris les repas ajoutés par
  le skill `kilio-journal-nutrition`.

## 2. Audit des navigations (phase 1.4) avec décision et résultat

Audit du code : aucun `prefetch={true}`, `prefetch` nu ni `prefetch={false}`
dans `src/`. Le seul wrapper de `next/link`, `TransitionLink`, transmet les
`LinkProps`, mais aucun appelant ne passe `prefetch`. **Contrat hérité à
préserver : vide.** Le préchargement manuel de `NavigationEditContext`
(`router.prefetch(item.href)`, modules non épinglés) est audité à part (§8).

« Coût » = invocations serveur ajoutées par un préchargement propre à chaque
lien (`prefetch={true}`) : une par lien visible, à chaque affichage de la
page source.

| Navigation (lien → destination) | Dépendance à l'URL | Prêt au clic avant | Proposé | Coût du préchargement par lien | Décision | Résultat |
|---|---|---|---|---|---|---|
| Journal ‹ › (→ `?date=J±1&jour=`) et swipe | `?date`, `?jour` + Supabase | `loading.tsx` générique (skeleton + titre) | App Shell agrandi ; préchargement du jour possible avec cache | 2 requêtes par affichage, ~2 lectures Supabase chacune | App Shell seul | Sous-nav, titre, ‹ ›, bascule Repos/Entraînement instantanés ; jour en streaming |
| Journal Repos/Entraînement (→ `?jour=`) | `?date`, `?jour` | idem | idem | 1 requête (l'autre type) | App Shell seul | idem |
| Recettes → `/nutrition/recettes/[id]` | `params.id` + 5 lectures | `loading.tsx` de la fiche | App Shell seul (liste longue) | 1 requête par carte visible | App Shell seul | Inchangé : skeleton de la fiche puis streaming |
| `/objectifs` → `[id]` | `params.id`, données client (TanStack) | Coquille client + skeleton | App Shell seul (rien à précharger côté serveur) | Aucun gain | App Shell seul | Inchangé |
| `/documents` → `[id]` | `params.id` + 2 lectures | `loading.tsx` | App Shell seul (liste de cartes) | 1 requête par carte visible | App Shell seul | Inchangé |
| `/collection` → `[id]` | `params.id`, données client (TanStack) | Coquille client + skeleton | App Shell seul | Aucun gain | App Shell seul | Inchangé |
| Budget → Transactions (filtres `?compte&categorie&mois&date&q`) | `searchParams` + récurrences + 3 lectures | `loading.tsx` | App Shell agrandi | Filtres pilotés par `router.push` (pas de `<Link>`) | App Shell seul | En-tête et liens Calendrier/Récurrentes instantanés |
| Budget → Catégories (`?type_periode&periode`) | `searchParams` + date du jour | `loading.tsx` | App Shell agrandi (sélecteur dans la coquille) | Boutons `router.push` : à convertir en liens | App Shell seul | Titre, sélecteur (inactif le temps de lire l'URL), « Ajouter une catégorie » instantanés |
| Statistiques ← → (`?periode`) | `searchParams` + récurrences + 3 lectures | `loading.tsx` | App Shell agrandi ; préchargement du mois possible si la génération des récurrences sort du rendu | 2 requêtes par affichage | App Shell seul | Titre, lien Calendrier, cadre ← →, titres et légende des 3 cartes instantanés |
| Calendrier ← → (`?periode`) | idem | `loading.tsx` | idem | 2 requêtes par affichage | App Shell seul | Titre, lien Liste, cadre ← →, jours de la semaine instantanés |
| Budget → Comptes, Récurrentes | aucune (données seulement) | `loading.tsx` | App Shell agrandi | — | — | Comptes : « Ajouter un compte » dans la coquille ; Récurrentes : en-tête réel (déjà identique à l'ancien `loading.tsx`) |
| `/plus` → `/budget` | aucune (mois courant = requête) | `loading.tsx` | App Shell agrandi | — | — | Titre et carte « Autres vues » instantanés |
| `/agenda` (vue/date) | vue et date en state client, `?tache` lu côté client | Coquille statique | App Shell seul | Aucun gain (données TanStack) | App Shell seul | Inchangé |
| `/notes?action=new` | `?action` | `loading.tsx` | App Shell seul | Aucun lien dans l'app (raccourci PWA du manifest) | App Shell seul | Inchangé |

Tableau « `prefetch={false}` » demandé par le skill (Navigation | Pourquoi il
n'est peut-être plus nécessaire) : **vide**, aucun `prefetch={false}` dans
`src/`.

## 3. À parcourir (build de production)

| Lien à cliquer | Instantané | En streaming |
|---|---|---|
| « Journal » (sous-nav de Recettes, ou `/nutrition/journal`) | Sous-nav Journal/Recettes, titre « Journal », cadres ‹ › et Repos/Entraînement (inactifs), skeletons | Date du jour (eyebrow), liens ‹ › actifs, objectif, résumé, repas |
| ‹ / › ou swipe dans le Journal | Mêmes éléments | Jour visé, avec le glissement `agenda-glisse-*` sur le contenu du jour |
| « Budget » (grille Plus) | « Budget / Vue d'ensemble », carte « Autres vues » | Solde total, mois courant, catégories en dépassement |
| « Voir les transactions » | Titre, liens Calendrier et Récurrentes | Filtres, bouton d'ajout, liste |
| « Voir les 2 comptes » | Titre, « Ajouter un compte » | Liste des comptes |
| « Voir toutes les catégories » | Titre, Semaine/Mois/Année et ← → (inactifs), « Ajouter une catégorie » | Onglet actif, libellé de période, cartes |
| « Statistiques » | Titre, lien Calendrier, cadre ← →, titres et légende des cartes | Période, répartitions, tendance |
| « Calendrier » | Titre, lien Liste, cadre ← →, L M M J V S D | Période, grille avec les totaux par jour |
| « Transactions récurrentes » | Titre | Bouton d'ajout, liste |

## 4. Caches ajoutés

**Aucun**, sur ta décision de garder l'App Shell seul pour les 4 groupes.
Conséquences :

- aucun tag, aucun `cacheLife`, aucun `updateTag` ajouté ; les
  `revalidatePath` existants sont inchangés ;
- les écritures externes (skill `kilio-journal-nutrition`, aliments modifiés
  hors de l'app, fonction `envoyer-rappels-documents`) restent visibles dès le
  chargement suivant, sans délai de cache ;
- la date du jour n'est figée nulle part : sans `?date`, le Journal appelle
  `connection()` avant `new Date()` ; le Budget fait de même avant le mois
  courant et la génération des récurrences ;
- tests de mutation propres aux caches : sans objet. Le seul cache de données
  existant (préférences de navigation, `preferences-navigation`) garde son test
  de mutation, vert (`e2e/preferences-navigation.spec.ts`, 4/4).

Pour mémoire, ce qu'un préchargement par lien aurait demandé (présenté lors de
la décision) : Journal, tags `journal-<date>` + objectifs, `updateTag` dans 9
actions et un `cacheLife` court (≥ 30 s de `stale` et ≥ 5 min d'`expire` pour
rester préchargeable) à cause des écritures du skill ; Budget, sortir
`genererOccurrencesDues` du rendu (écriture à chaque affichage) et invalider
21 actions.

## 5. Différentiels des coquilles

Garde : `e2e/coquilles-journal-budget.spec.ts`. Par route, sous `instant()` :
un élément du vrai en-tête, absent de l'ancien `loading.tsx`, est visible ;
le contenu dépendant des données est retenu (`toHaveCount(0)`), puis arrive
en streaming (navigation client). Chargement initial et navigation client,
à 1280 et 390 px.

| Route | Marqueur d'en-tête | Contenu retenu | Avant (`6b1edd7`) | Après |
|---|---|---|---|---|
| `/nutrition/journal` | lien « Recettes » (sous-nav) | titre « Repas du jour » | RED | GREEN |
| `/budget` | lien « Statistiques » (Autres vues) | « Solde total » | RED | GREEN |
| `/budget/transactions` | lien « Calendrier » | « Cinéma et resto » | RED | GREEN |
| `/budget/comptes` | bouton « Ajouter un compte » | « Livret A » | RED | GREEN |
| `/budget/categories` | bouton « Mois » | « Alimentation » | RED | GREEN |
| `/budget/statistiques` | lien « Calendrier » | « Livret A » | RED | GREEN |
| `/budget/calendrier` | lien « Liste » | « +2 400,00 € » | RED | GREEN |
| `/budget/recurrentes` | titre « Transactions récurrentes » | « Loyer » | GREEN | GREEN |

- Vérification préalable (phase B, sans verrou, supprimée ensuite) : les 8
  marqueurs et contenus s'affichent pour l'utilisateur de test (8/8).
- RED : 14 échecs sur le projet desktop, tous sur l'assertion d'en-tête.
  Sur le commit d'avant reconstruit dans un worktree : 28 échecs (7 routes × 2
  navigations × 2 largeurs). `/budget/recurrentes` est vert avant comme après :
  son ancien `loading.tsx` contenait déjà l'en-tête exact. Sa refonte sert
  seulement l'uniformité (un vrai en-tête au lieu d'une copie).
- GREEN : 32/32 après correctif.

**Parité** (`e2e/parite-journal-budget.spec.ts`, **verte avant et après**,
17/17 + swipe réservé au mobile) : jour par défaut puis ‹, bascule
Entraînement, état vide, suppression optimiste (ligne retirée alors que la
Server Action est retenue, puis `DELETE` bien reçu), swipe droite/gauche,
totaux de la vue d'ensemble, ← Précédent des Statistiques, jour du calendrier
→ transactions filtrées → « Effacer ✕ », Suivant → des Catégories en conservant
le type de période. `e2e/parite.spec.ts` (thème, service worker,
`AppResumeRefresh`, mise à jour optimiste TanStack) : 14/14.

**Écarts de comportement assumés**

- Journal : au changement de jour, seul le contenu du jour glisse ; la
  sous-navigation et le titre restent en place (ils glissaient avec le reste).
  Le geste est inchangé et couvre toujours toute la page. Un swipe fait avant
  l'arrivée du jour ne fait rien.
- Pendant le streaming, les cadres ‹ ›, Repos/Entraînement, Semaine/Mois/Année
  et ← → sont visibles mais inactifs. Ils deviennent cliquables dès que l'URL
  est lue.
- Budget : la génération des récurrences dues ne bloque plus l'affichage de
  l'en-tête. Elle s'exécute une seule fois par requête, même quand une page lit
  ses données depuis plusieurs `<Suspense>` (Statistiques).

## 6. Captures avant/après à 390 px (coquille sous verrou)

Dossier `reports/captures-2026-09-24-partial-prefetching/` : pour `journal`,
`budget`, `transactions`, `comptes`, `categories`, `statistiques`,
`calendrier`, `<route>-coquille-avant.png` (commit `6b1edd7`) et
`<route>-coquille-apres.png` (commit `4c5e095`). Elles ont été prises sur les
builds de production, avec le verrou de test `instant()` actif, donc seule la
coquille est visible. Avant : skeleton générique. Après : vrai en-tête.

## 7. Hypothèses non vérifiées

- **Rendu avec les vraies données Supabase** : Supabase est injoignable depuis
  le sandbox (proxy). Tout a été vérifié contre `e2e/mock-supabase.mjs`, enrichi
  pour la session : repas de J-2 à J+1, recettes, comptes, catégories, budgets,
  transactions sur trois mois, filtres PostgREST et écritures. À vérifier en
  production : Journal d'un jour réel (repas ajoutés par le skill), Budget d'un
  mois réel, Catégories en hebdomadaire.
- Préchargement réel : vérifié sur build de production local (`next start`),
  pas sur Vercel.
- `/notes` : sous le flag, son lien de la barre du bas précharge en mode
  « runtime shell » (`Next-Router-Prefetch: 3`), car la page lit `searchParams`
  en tête. La navigation reste instantanée (garde `/plus → /notes` verte).
  Aucun insight ne l'a signalé. Suite possible : sortir le titre de la page et
  mettre la lecture de `?action` sous `<Suspense>`.

## 8. Fichiers modifiés et vérifications

**Configuration** : `next.config.ts` (`partialPrefetching: true`).

**Journal** (`src/app/(app)/nutrition/journal/`) : `page.tsx` (synchrone,
coquille), `jour.ts` (nouveau, lecture de `?date`/`?jour`, `connection()` sans
date), `JournalJour.tsx` (nouveau, parties dépendantes du jour),
`JournalNavigationJour.tsx` (nouveau, ‹ › et bascule, actifs ou inactifs),
`JournalJourSkeleton.tsx` (nouveau, extrait de l'ancien `loading.tsx`),
`JournalSwipeWrapper.tsx` (geste sur toute la page, jour reçu du contenu
streamé), `loading.tsx` supprimé.

**Budget** (`src/app/(app)/budget/`) : `requete.ts` (nouveau : génération des
récurrences dédoublonnée par requête, lecture des périodes),
`PeriodeNavigation.tsx` (nouveau), `page.tsx`, `transactions/page.tsx`,
`comptes/page.tsx`, `categories/page.tsx`, `categories/PeriodeSelector.tsx`
(rendable dans la coquille, sans `useSearchParams`), `statistiques/page.tsx`,
`recurrentes/page.tsx`, `calendrier/page.tsx` ; 7 `loading.tsx` supprimés
(skeletons extraits dans les pages).

**Tests et outillage** : `e2e/mock-supabase.mjs`,
`e2e/coquilles-journal-budget.spec.ts` (nouveau),
`e2e/parite-journal-budget.spec.ts` (nouveau), `instant-nav.rig.md`,
`.claude/skills/next-partial-prefetching-adoption/`,
`.claude/skills/next-dev-loop/`.

**Déroulé de l'adoption**

1. Baseline flag OFF (porte de préservation) : suite existante verte.
2. `export const prefetch = 'partial'` + marqueurs `TODO(per-link-prefetch)`
   sur les 9 destinations serveur candidates (marqueur seul sur les 2 pages
   client, où l'export est interdit). **Suite rouge dans cet état
   intermédiaire** (12 échecs) : sous le verrou de test, le clic vers une
   destination adoptée, ou vers un lien révélé par le défilement pendant le
   clic, ne navigue pas. Sans verrou, la navigation fonctionne. Cet état n'est
   pas livré seul : il est noté dans les WALLS du rig.
3. Flag global + codemod `remove-partial-prefetch` (9 fichiers modifiés,
   0 erreur) : suite verte.
4. Balayage `next dev` (skill `next-dev-loop`, navigateur headless faute
   d'affichage) : aucun insight « URL data ». En revanche, 5
   `blocking-prerender-current-time` (`new Date()`) : Journal, Transactions,
   Catégories, Statistiques, Calendrier. Tous sont résolus par l'agrandissement
   des coquilles, et le balayage suivant est propre. Seuls restent des
   avertissements préexistants (`motion()` déprécié, hydratation dnd-kit sur
   `/plus`).
5. Retrait des marqueurs (décision App Shell seul). Les 3 pages reformatées par
   le codemod retrouvent leur contenu d'origine.

**Préchargement impératif** (`router.prefetch` de `NavigationEditContext`,
sous `next start`, depuis `/taches`) : mêmes requêtes avant et après le flag
(`/_tree` puis la coquille du segment de page) et mêmes tailles pour les 11
modules non épinglés, sauf `/budget` (11 020 → 14 005 octets), dont la coquille
porte maintenant le vrai en-tête et « Autres vues ». Avant comme après, ces
préchargements ne contiennent aucune donnée (« Solde total » absent) : rien de
ce qu'ils chauffaient n'est perdu.

| Commande | Résultat |
|---|---|
| `npm run test:instant`, flag OFF, avant toute adoption | 106 réussis, code 0 |
| idem avec les exports `prefetch = 'partial'`, flag OFF | 94 réussis, 12 échecs, code 1 (état intermédiaire, voir ci-dessus) |
| idem après flag global + codemod | 106 réussis, code 0 |
| `e2e/run-instant-rig.sh --no-build` sur la nouvelle garde, commit d'avant (RED) | 14 échecs (assertion d'en-tête) sur desktop ; 28 sur les deux largeurs |
| `npm run test:instant` après les coquilles (GREEN) | 138 réussis, code 0 |
| Parité et coquilles sur le commit d'avant (worktree, build de production) | parité 17 réussies + 1 ignorée ; coquilles 28 échecs, 4 réussies (Récurrentes) |
| `npx tsc --noEmit` | code 0 |
| `npm run lint` | code 0, aucun avertissement |
| `SUPABASE_SERVICE_ROLE_KEY=factice npm run build` | code 0 (repli journalisé des préférences de navigation, Supabase injoignable) |
| `npm run build` sans clé | échec « supabaseKey is required » au prérendu, **préexistant** (même échec sur le commit d'avant) |
| `npm run test:instant` final (build frais) | 155 réussis, 1 ignoré, code 0 : instant 88, coquilles 32, parité Journal/Budget 17, parité 14, mutation préférences 4 |
| `e2e/run-instant-rig.sh --no-build` instant + coquilles + parités `--repeat-each=3` | 453 réussis, 3 ignorés, code 0 : déterministe |

**Incident de rig pendant la session** : des captures et sondes lancées contre
un `next start` démarré à la main sans `EXPOSE_TESTING_API=1` ont d'abord
laissé passer le contenu sous verrou. `next start` relit `next.config.ts` et
le serveur ne retenait donc plus rien. Aucun résultat de ce rapport n'en
provient : captures et sondes ont été refaites avec la variable, et le rig
documente désormais qu'elle est requise au build **et** au démarrage.

**Avant une Pull Request** : les builds **Preview** Vercel échouent tant que
`SUPABASE_SERVICE_ROLE_KEY` n'est pas définie pour l'environnement Preview
(prérendu, voir le rapport précédent). La branche `kilio` déploie en
Production, où la clé existe.
