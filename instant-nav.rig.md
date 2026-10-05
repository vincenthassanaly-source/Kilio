# instant-nav rig: Kilio

Rig de vérification des tests `instant()` (skill `next-cache-components-optimizer`,
voir `.claude/skills/next-cache-components-optimizer/rig-template.md`).
Rapports associés : `reports/2026-09-24-navigation-instantanee-cache-components.md`,
`reports/2026-09-24-partial-prefetching-coquilles-journal-budget.md`
(skill `next-partial-prefetching-adoption`, même rig).

- BUILD: `e2e/run-instant-rig.sh` = `next build` puis `next start --port 3100`
  (build de production, jamais `next dev`). `--no-build` réutilise le dernier
  `.next` (uniquement si le code n'a pas changé depuis ce build).
- EXPOSE: `EXPOSE_TESTING_API=1` au moment du `next build` ET du `next start`
  (posé par le script pour les deux) → `experimental.exposeTestingApiInProductionBuild`
  dans `next.config.ts`. `next start` relit la config : sans la variable, le
  serveur ne retient plus rien sous verrou au chargement initial et les tests
  (ou captures) lancés contre ce serveur sont faux. Jamais posé sur Vercel.
- RUN: `e2e/run-instant-rig.sh [--no-build] [arguments playwright…]`, par ex.
  `e2e/run-instant-rig.sh e2e/instant-navigation.spec.ts --project=mobile`.
  `BASE_URL=http://localhost:3100` est transmis à `playwright.config.ts`.
  Projets : `desktop` (1280×800) et `mobile` (390×844, tactile).
- TEST USER: public, aucune authentification (app mono-utilisateur, pas d'auth).
  État : faux Supabase `e2e/mock-supabase.mjs` (port 54321, latence 400 ms),
  démarré par le script s'il ne tourne pas. Données : `preferences_navigation`
  identique à la base réelle au 2026-09-24 (barre du bas `/`, `/agenda`,
  `/taches`, `/notes`), `reglages_nettoyage`, une liste et une tâche due
  aujourd'hui ; depuis le 2026-09-24 (Partial Prefetching), des données
  réalistes pour le Journal (repas de J-2 à J+1, deux recettes, objectifs
  repos/entraînement) (le module Budget a été supprimé le 2026-10-05). Dates relatives au jour
  du test (UTC). Le faux Supabase applique les filtres PostgREST usuels et les
  écritures ; `GET /__writes` liste les écritures reçues, `GET /__reset` remet
  les données à zéro. Les autres tables sont vides (états vides).
- DRIFT: base réelle ≠ faux Supabase (listes vides, pas de jointures réelles).
  Les marqueurs de coquille (titre `<h1>` de page, lien « Plus » de la barre du
  bas, `data-testid="dashboard-shell"`) ne dépendent d'aucune donnée : ils sont
  présents dans les états vides. Personnaliser la barre du bas dans le faux
  Supabase change les liens `BottomNav` utilisés comme déclencheurs.
- CONTRACTS: `e2e/instant-navigation.spec.ts` + `e2e/routes.ts` ;
  parité : `e2e/parite.spec.ts`.
  Chargement initial (`page.goto` dans `instant()`, `baseURL`) pour les 21
  routes principales ; navigation client (clic réel sur un `<Link>`) depuis la
  barre du bas, la grille « Plus », `/taches` et le Journal ;
  variante auto-validante (contenu du jour `toHaveCount(0)` sous verrou puis
  visible) pour `/` et `/habitudes`.
- LOOP: local — build (≈ 1 min) → start → test → arrêt du serveur → édition.
  L'agent peut tout faire seul dans le sandbox.
- LIVENESS: n/a ; build et start locaux enchaînés par le script.
- WALLS:
  - Le sandbox cloud bloque Supabase (proxy 403) et n'a pas la clé service :
    d'où le faux Supabase, branché via `E2E_SUPABASE_URL` (lu par
    `next.config.ts`, jamais défini sur Vercel).
  - `lsof` ne voit pas le `next-server` dans ce sandbox : le script arrête le
    serveur via `fuser` et refuse de démarrer si le port 3100 reste occupé.
    Sans ça, un ancien serveur continue de répondre et les tests mesurent un
    ancien build.
  - Ne jamais lancer `pkill -f` avec un motif présent dans la commande
    elle-même (le shell courant est tué).
  - Après un `next dev`, supprimer `.next/dev` avant `next build`
    (types de routes périmés).
  - Les pages statiques sont servies par `next start` avec
    `s-maxage, stale-while-revalidate` ; Chrome applique ce SWR à son cache
    HTTP. Les relectures après mutation se font donc dans un contexte
    navigateur neuf (`e2e/preferences-navigation.spec.ts`).
  - Un test de mutation laisse un nouvel état dans le cache ISR sur disque
    (`.next`) : le rejouer demande un rebuild (pas `--no-build`).
  - Adoption incrémentale du Partial Prefetching (`export const prefetch =
    'partial'` avec `partialPrefetching` désactivé) : sous le verrou de test,
    un clic vers une destination adoptée (ou vers un lien révélé par le
    défilement pendant le clic) ne navigue pas (Next 16.3.3) ; sans verrou la
    navigation fonctionne. L'état final (flag global) passe. Ne pas livrer
    l'adoption route par route sans revérifier ce point.

## Rig alternatif : preview deploy Vercel

Pour mesurer contre la vraie base :

1. Ajouter `SUPABASE_SERVICE_ROLE_KEY` à l'environnement **Preview** du projet
   Vercel (aujourd'hui définie pour Production uniquement ; sans elle, un build
   Preview échoue désormais au prérendu, voir le rapport).
2. Brancher l'API de test sur la preview :
   `exposeTestingApiInProductionBuild: process.env.VERCEL_ENV === "preview" || exposeTestingApi`.
3. `BASE_URL=<url de la preview> npx playwright test e2e/instant-navigation.spec.ts`
   après avoir vérifié (LIVENESS) que la preview correspond au commit `HEAD`
   (API Vercel : déploiement dont `githubCommitSha` = `git rev-parse HEAD`).
4. Les tests de mutation et de parité TanStack s'appuient sur le faux Supabase :
   à ne pas lancer contre la vraie base.
