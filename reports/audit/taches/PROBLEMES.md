# Module Tâches : problèmes relevés (audit du 2026-11-25)

Audit mobile (390 × 844, tactile), clair et sombre, sur le faux Supabase. Lecture seule :
aucune modification dans `src/`, `e2e/` ni `supabase/`.

- Rapport visuel : `reports/audit/taches/index.html` (écrans au repos et pellicule d'usage)
- Critique /impeccable : `reports/audit/taches/CRITIQUE.md`
- Scénarios : `reports/audit/taches/scenarios/*.json` (7 parcours, 96 étapes)
- Sondes ciblées (captures) : `reports/audit/taches/sondes/`

## Comment l'audit a tourné (à lire d'abord)

L'instance fournie (app `:3110`, faux Supabase `:54331`) **ne parle pas à son faux Supabase**
(voir P1). Sur elle, `/taches` reste en squelette et `/taches/listes` affiche « Une erreur est
survenue » (`sondes/X1-supabase-injoignable-taches.png`). Je ne l'ai pas modifiée.
Pour auditer quand même, sans toucher aux ports des autres agents ni rebuilder, j'ai lancé
pour chaque parcours une instance jetable **dans un espace réseau privé** (`unshare -n`) :
le même build `.next`, `next start --port 3110` et `e2e/mock-supabase.mjs` sur le port 54321
qui y est inliné, visibles seulement à l'intérieur de cet espace réseau. Les instances
`:3110` et `:3120` de l'hôte n'ont pas été touchées (vérifié après coup, HTTP 200).
Deux ajustements, faits dans des copies des scripts du skill (dans le scratchpad, pas dans
le dépôt) :
- `executablePath` pointé sur le Chromium présent (`chromium_headless_shell-1243`). Le
  Playwright du dépôt attend la version 1194, absente.
- `navigator.onLine` forcé à `true`. Sinon, dans l'espace réseau isolé, la pastille
  « Hors ligne » apparaît et les écritures passent par la file hors ligne.

Bruit présent à chaque `goto`, ignoré partout : `404 /_vercel/speed-insights/script.js`.
Ce script n'existe qu'une fois déployé sur Vercel, ce n'est pas un bug.

## Synthèse

| Gravité | Nombre |
|---|---|
| Bloquant | 1 (outillage d'audit, pas l'app en production) |
| Majeur | 2 |
| Mineur | 6 |
| Design | 5 |
| Artefacts du faux Supabase (pas des bugs de l'app) | 3 |

---

## P1. BLOQUANT (outillage) : les instances d'audit par emplacement appellent toutes le faux Supabase 54321

- **Écran** : `/taches` et `/taches/listes` sur `http://localhost:3110`.
  Capture : `sondes/X1-supabase-injoignable-taches.png`. Pour `/taches/listes`, la première
  capture (écran d'erreur) a été remplacée depuis ; à reproduire avec `curl` sur l'instance de l'hôte.
- **Attendu** : `e2e/audit-instance.sh 1` sert une app branchée sur `http://localhost:54331`.
- **Observé** : chaque lecture serveur échoue avec `TypeError: fetch failed`
  (`/tmp/kilio-next-1.log`). Rien n'écoute sur 54321 (`curl` renvoie 000).
  `grep -o localhost:543.. .next/server` → seulement `localhost:54321`.
- **Diagnostic** : **bug de l'outillage confirmé**. Ce n'est ni un bug de l'app en production, ni un artefact du faux Supabase.
- **Cause** : `next.config.ts:52-53` copie `E2E_SUPABASE_URL` dans `env.NEXT_PUBLIC_SUPABASE_URL`.
  Next **inline** cette valeur au moment du `next build`. `e2e/audit-instance.sh:11` ne
  pose `E2E_SUPABASE_URL` qu'au `next start`, donc trop tard. Tous les emplacements visent le
  port du build (54321). Les instances 3110 et 3120 partagent donc la même base, et elle
  n'est pas lancée.
- **Correctif proposé** : lire l'URL à l'exécution côté serveur, sans passer par `NEXT_PUBLIC_*` :
  ```diff
  --- a/src/lib/supabase/admin.ts
  +++ b/src/lib/supabase/admin.ts
   export function createAdminClient() {
     return createClient<Database>(
  -    process.env.NEXT_PUBLIC_SUPABASE_URL!,
  +    // E2E_SUPABASE_URL est lu à l'exécution (next start) : une instance d'audit
  +    // par emplacement doit pouvoir viser son propre faux Supabase sans rebuild.
  +    process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.SUPABASE_SERVICE_ROLE_KEY!
     );
   }
  ```
  Ce correctif ne suffit que si aucun code client n'appelle Supabase directement. À vérifier
  avec `grep NEXT_PUBLIC_SUPABASE_URL src`. Sinon, `audit-instance.sh` doit refuser de
  démarrer quand `MOCK_PORT` ≠ 54321, ou démarrer dans un espace réseau privé (méthode
  utilisée ici).
- **Test de non-régression** : dans `e2e/audit-instance.sh`, après le démarrage, faire
  `curl -sf "$BASE/taches/listes" | grep -q "Listes"` et échouer bruyamment sinon. Côté
  Playwright :
  ```ts
  test("l'instance d'audit lit son propre faux Supabase", async ({ page }) => {
    await page.goto("/taches");
    await expect(page.getByRole("button", { name: /\(modifier\)$/ }).first()).toBeVisible({ timeout: 10_000 });
  });
  ```

## P2. MAJEUR : l'appui long sélectionne la carte, puis le relâchement la désélectionne aussitôt

- **Étape** : sondes S0 et S1 (appui long tactile de 700 à 800 ms sur « Tâche e2e du jour »).
  Captures : `sondes/S0-pendant-appui-long.png`, `sondes/S1-appui-long.png`.
- **Attendu** : la carte appuyée est cochée, la barre propose « Reporter / Déplacer / Supprimer ».
- **Observé** : pendant l'appui, la carte est bien sélectionnée (`Désélectionner « … »` existe).
  Après le relâchement, elle ne l'est plus. La barre affiche « Touche des tâches pour les
  choisir » avec 0 sélection. Événements relevés : `pointerdown → pointerup → click` (le `click`
  suit le relâchement).
- **Diagnostic** : **bug confirmé** en émulation tactile Chromium. Le code prévoit lui-même ce
  `click` (« Le clic qui suit un appui long réussi est avalé »). Sur un appareil, la même chose
  arrive dès que le navigateur émet ce clic.
- **Cause** : `src/app/(app)/taches/TasksList.tsx:320` : `if (!onAppuiLong) return undefined;`.
  L'appui long appelle `onEnterSelect`, donc `selectionMode` devient vrai. Au rendu suivant,
  `TasksList.tsx:398` appelle `useAppuiLong(undefined)` et les gestionnaires disparaissent,
  **dont `onClickCapture` (l.345) qui devait avaler le clic**. Le `click` atteint alors
  `onClick` du mode sélection (l.631-639), qui appelle `onToggleSelect(id)` et désélectionne
  la carte. Le test unitaire `TasksList.appuiLong.test.tsx` passe parce que son
  `onEnterSelect` est un `vi.fn()` qui ne fait jamais passer la carte en mode sélection.
- **Correctif proposé** : garder les gestionnaires montés et ne neutraliser que le départ.
  ```diff
  --- a/src/app/(app)/taches/TasksList.tsx
  +++ b/src/app/(app)/taches/TasksList.tsx
  @@ function useAppuiLong(onAppuiLong: (() => void) | undefined) {
  -  if (!onAppuiLong) return undefined;
     return {
       onPointerDown: (e: React.PointerEvent) => {
  +      // Sans rappel (déjà en sélection), rien ne démarre, mais onClickCapture
  +      // reste monté pour avaler le clic qui suit l'appui long déclencheur.
  +      if (!onAppuiLong) return;
         if (e.pointerType === "mouse" || !e.isPrimary) return;
  ```
  Le minuteur appelle `onAppuiLong()`. Il faut garder une référence (`useRef`) ou un garde
  `onAppuiLong?.()`.
- **Test Playwright de non-régression** (`e2e/taches.spec.ts`, projet `mobile`) :
  ```ts
  test("appui long : la carte appuyée reste sélectionnée après le relâchement", async ({ page, context }) => {
    await page.goto("/taches");
    const titre = page.getByRole("button", { name: /^Tâche e2e du jour \(modifier\)/ });
    const bb = (await titre.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const pt = { x: bb.x + 40, y: bb.y + bb.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt] });
    await page.waitForTimeout(700);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByRole("button", { name: /^Désélectionner « Tâche e2e du jour »/ })).toBeVisible();
    await expect(page.getByText("Touche des tâches pour les choisir")).toHaveCount(0);
  });
  ```
  Ajouter aussi un cas unitaire dont `onEnterSelect` rerend `TasksList` avec `selectionMode`.

## P3. MAJEUR : Supabase lent ou injoignable, le squelette reste affiché plus de 30 s sans message

- **Écran** : `/taches` sur l'instance de l'hôte (Supabase injoignable de fait, voir P1).
  Capture : `sondes/X1-supabase-injoignable-taches.png` (squelette après 25 s).
- **Attendu** : au bout de quelques secondes, « Impossible de charger les tâches. Réessayer »
  (`ErrorInline`, `TachesView.tsx:508`) ou une indication que le chargement traîne.
- **Observé** : le préchargement serveur échoue en silence (`prefetchQuery` avale l'erreur),
  donc rien n'est hydraté. Le client relance alors la lecture par action serveur. Les actions
  serveur passent **une par une**, et chacune met environ 7 s à échouer (tâches, listes et
  tags, plus une relance chacune avec `retry: 1`). Mesure : POST à 7 s, 500 à 14 s, 500 à
  21 s, toujours le squelette à 25 s, sans aucun texte.
- **Diagnostic** : **bug probable**, à confirmer en production. Les 7 s par échec dépendent du
  sandbox. L'enchaînement (préchargement avalé, actions en file, relance) est bien dans le code.
- **Cause** : `src/app/(app)/taches/page.tsx:17-21`. `prefetchQuery` ne remonte jamais
  l'échec, et la page ne transmet pas « le serveur n'a pas pu lire ». En plus, les trois
  `useQuery` (`TachesView.tsx:134-139`) se mettent en file derrière les actions serveur, et
  `retry: 1` dans `src/app/providers.tsx:36` double l'attente.
- **Correctif proposé** :
  ```diff
  --- a/src/app/(app)/taches/page.tsx
  +++ b/src/app/(app)/taches/page.tsx
  -  await Promise.all([
  -    queryClient.prefetchQuery({ queryKey: queryKeys.taches, queryFn: getTachesAvecRelationsEnCache }),
  +  const resultats = await Promise.allSettled([
  +    queryClient.fetchQuery({ queryKey: queryKeys.taches, queryFn: getTachesAvecRelationsEnCache }),
       ...
     ]);
  +  const lectureServeurKo = resultats[0].status === "rejected";
  ...
  -        <TachesView />
  +        <TachesView lectureServeurKo={lectureServeurKo} />
  ```
  Dans `TachesView`, quand `lectureServeurKo` vaut vrai, afficher tout de suite `ErrorInline`
  avec « Réessayer » plutôt que le squelette. À défaut, afficher « Toujours en chargement… »
  au bout de 5 s.
- **Test Playwright de non-régression** : servir une variante du faux Supabase qui renvoie 503
  sur `/rest/v1/taches`, puis vérifier que l'erreur s'affiche vite :
  ```ts
  await page.goto("/taches");
  await expect(page.getByText("Impossible de charger les tâches")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("button", { name: /réessayer/i })).toBeVisible();
  ```
  Il faut une fixture « panne » dans `e2e/mock-supabase.mjs`, qui n'existe pas encore.

## P4. MINEUR : le formulaire d'édition met un moment à apparaître, la carte s'ouvre vide

- **Étape** : `01-creer-modifier-supprimer`, étape 9 (`parcours/01-creer-modifier-supprimer/09-click.png`).
- **Attendu** : la carte ouverte montre tout de suite le titre et les champs.
- **Observé** : environ 200 px de carte vide au-dessus de « + Sous-tâche… / Annuler / Supprimer »,
  puis le formulaire arrive (étape 10).
- **Diagnostic** : **bug confirmé** (saccade visible).
- **Cause** : `TasksList.tsx:55`, `dynamic(() => import("./AddTaskForm"), { ssr: false })` est
  appelé sans option `loading`. Le préchargement au repos (`preloadAddTaskForm.ts`) n'avait pas
  encore eu lieu.
- **Correctif** : `dynamic(..., { ssr: false, loading: () => <AddTaskFormSquelette /> })`
  (titre et liste en squelette), ou précharger le formulaire au `pointerdown` sur le titre.

## P5. MINEUR : recharger pendant l'enregistrement d'une tâche, et la nouvelle tâche n'apparaît pas

- **Étape** : sonde B (`probe-creation`). Rechargement 300 ms après « Ajouter ».
- **Observé** : la tâche est bien en base. Elle est absente après le premier rechargement et
  apparaît au deuxième. Aucune perte de données.
- **Diagnostic** : **comportement réel**, mais c'est une course : le rendu serveur lit le cache
  avant que `revalidateTachesPaths()` ait expiré le tag. Le bouton affiche
  « Enregistrement… » pendant environ 1,8 s avec la latence du faux Supabase.
- **Cause** : `src/app/actions/taches.ts:292` (revalidation en fin d'action, après tags et
  images) et `src/lib/taches/cache.ts:17-18`.
- **Correctif** : appeler `revalidateTachesPaths()` juste après l'insertion (l.257-260), puis une
  seconde fois après les tags et les images.

## P6. MINEUR : un tag en double affiche un message technique (anglais Postgres)

- **Écran** : `/taches/listes`, « Ajouter un tag » avec un nom déjà pris
  (`sondes/G1-tag-double.png`).
- **Attendu** : « Un tag « #x » existe déjà », comme pour les listes
  (`sondes/L1-liste-double.png` : « Une liste « Perso » existe déjà. Choisis un autre nom. »).
- **Observé (faux Supabase)** : le doublon est créé, car le faux Supabase n'applique pas la contrainte
  unique. **En base réelle**, `tags.nom` est unique (`upsert … onConflict: "nom"`,
  `taches.ts:194-197`), donc `createTag` renvoie tel quel `error.message`
  (`duplicate key value violates unique constraint …`).
- **Diagnostic** : **bug confirmé par lecture du code** ; l'écran réel n'a pas pu être observé.
- **Cause** : `src/app/actions/taches.ts:1162` : `if (error) return { error: error.message };`.
  Même problème dans `updateTag` (l.1182).
- **Correctif** :
  ```diff
  -  if (error) return { error: error.message };
  +  if (error) {
  +    if (error.code === "23505") return { error: `Un tag « #${nom} » existe déjà.` };
  +    console.error(`[tags] création impossible : ${error.message}`);
  +    return { error: "Impossible de créer le tag. Réessaie." };
  +  }
  ```

## P7. MINEUR : « Monter » et « Descendre » ne nomment pas la liste concernée

- **Écran** : `/taches/listes` (`ecrans/taches_listes.clair.png`).
- **Observé** : chaque ligne a `aria-label="Monter"` et `aria-label="Descendre"`. Avec plusieurs
  listes, un lecteur d'écran entend « Monter, Monter, Monter ».
- **Cause** : `src/app/(app)/taches/listes/ListesManager.tsx:119` et `:128`.
- **Correctif** : ``aria-label={`Monter « ${liste.nom} »`}`` (idem pour Descendre). C'est déjà le
  format des sous-tâches (`TasksList.tsx:227`).

## P8. MINEUR : zones de tap sous 44 px sur « Listes & tags »

- **Mesure** (sonde probe2) : boutons « Modifier » 78 × 35 px, lien retour « Tâches » 67 × 21 px.
  Sur `/taches`, toutes les cibles font au moins 44 px grâce aux zones élargies (pastille 22 px,
  `hitSlop` 11).
- **Cause** : `ListesManager.tsx:132` et `TagsManager.tsx` (`ghostButton` sans `min-h-11`),
  `BackLink`.
- **Correctif** : `min-h-11` sur `ghostButton` dans ces lignes, et une zone élargie
  `after:-inset-y-3` sur `BackLink`.

## P9. MINEUR : la vue et les filtres sont perdus après un passage par « Gérer les listes »

- **Code** : `TachesView.tsx:104-111`. Vue, liste, tri et priorités sont dans des `useState`
  locaux, donc l'aller-retour vers `/taches/listes` remet « À faire » et tous les filtres à zéro.
  Pas capturé avec une vue autre que « À faire » (voir « Non testé »).
- **Correctif** : mettre `vue` et `liste` dans l'URL (`?vue=semaine&liste=…`), ou les garder en
  `sessionStorage`.

## D1. DESIGN : « À faire » ne montre que « Tâches terminées (1) », sans état vide

- `parcours/02-cocher-annuler/11-screenshot.png` (et le premier passage de 04/05).
  Une fois tout coché, l'écran affiche seulement le repli « Tâches terminées (1) ». Le message
  « Rien à faire pour l'instant » et le bouton « Ajouter une tâche » n'apparaissent pas, ce qui
  laisse un écran sans conclusion juste quand la journée est finie.
- **Cause** : `TasksList.tsx:1000-1001` n'affiche `messageVide` que si aucune carte n'est
  visible, actives et terminées confondues. Les terminées (repli `archivees`, l.1052) suffisent à le masquer.
- **Proposition** : si toutes les tâches de la vue sont faites, afficher au-dessus du repli
  « Tout est fait pour aujourd'hui. » et le bouton secondaire « Ajouter une tâche ».

## D2. DESIGN : la recherche reste limitée à l'onglet actif

- `parcours/05-recherche-filtres-vues/05-screenshot.png` : « Aucune tâche ne correspond à
  « zzzz introuvable » dans À faire. » Aucun moyen d'étendre la recherche à « Tout » en un tap.
- **Proposition** : sous le message, un bouton « Chercher dans toutes les tâches », qui passe
  `vue` à `toutes`.

## D3. DESIGN : la carte en édition pousse la liste vers le bas avec une grande marge

- `parcours/01-creer-modifier-supprimer/09-click.png` : `mb-28` sur la carte en édition
  (`TasksList.tsx:588`) laisse environ 112 px vides avant la carte suivante. Ça sert à dégager
  le bouton flottant, mais l'espace paraît accidentel.
- **Proposition** : masquer le bouton flottant pendant une édition en ligne, comme pendant la
  recherche, et revenir à l'espacement de la liste (`gap-2.5`).

## D4. DESIGN : les flèches Monter/Descendre désactivées restent visibles et presque invisibles

- `ecrans/taches_listes.clair.png` : avec une seule liste, les deux chevrons sont grisés à
  environ 1,5:1. Ils ne servent à rien et parasitent la ligne.
- **Proposition** : masquer les flèches quand il n'y a qu'une liste, et la flèche du bord
  concerné en tête ou en fin de liste.

## D5. DESIGN : un seul trait de la marque Kilio sur les deux écrans

- Les deux écrans sont propres et cohérents (même titre `screenTitle`, mêmes cartes
  `listCard`, vert Kcal seul en accent, sombre bien contrasté). Mais aucun élément n'est
  propre à Kilio : le trait signature (anneau de progression) n'apparaît nulle part dans Tâches.
  Ce point était déjà relevé « non traité » dans `reports/2026-11-10-taches-critique-impeccable.md`.
  Piste : une progression du jour (« 3/5 faites ») sous le titre, dans l'anneau Kcal.

---

## Artefacts du faux Supabase / du banc (pas des bugs de l'app)

- **A1. L'état d'un parcours fuit dans le suivant.** `GET /__reset` remet les données du faux
  Supabase à zéro, mais pas le cache serveur `"use cache"` (`src/lib/taches/cache.ts`,
  `revalidate: 60`). Au premier passage, le parcours 05 voyait encore la tâche cochée par le 04.
  Contourné ici en relançant une instance neuve pour chaque parcours. À corriger côté banc :
  après `/__reset`, appeler une route de test qui expire `TACHES_TAG`, ou redémarrer `next start`.
- **A2. Unicité de `tags.nom` non appliquée** par `e2e/mock-supabase.mjs`, ce qui masque P6.
  Fixture à compléter (je ne l'ai pas modifiée).
- **A3. Barre du bas « Courses / Nutrition » sur les premières captures** de l'instance de
  l'hôte : ce sont les préférences de navigation par défaut, tombées en repli faute de
  Supabase (P1, `src/lib/navigation/preferences.ts:86`). Avec un faux Supabase joignable, la
  barre est bien « Agenda / Notes ».

## Ce qui a été vérifié et fonctionne

Création (feuille, toast « Tâche ajoutée », persistance), modification du titre, suppression
différée avec toast « Annuler » puis disparition persistée, cochage et annulation via le toast
(persistés), titre vide ou fait d'espaces refusé (« Donne un titre à la tâche »), titre de
plus de 200 caractères coupé à 3 lignes sans débordement horizontal, double clic sur
« Ajouter » et double Entrée sans doublon, sous-tâches (ajout, compteur 0/2 puis 1/2,
persistance), recherche et état vide de recherche, filtre de priorité avec « Réinitialiser les
filtres », vues En retard et 7 jours, sélecteur de liste, création de liste (et refus d'un nom en
double), nouvelle liste proposée dans la feuille, création de tag, retour arrière qui ferme la
feuille et l'édition sans quitter `/taches`, retour depuis Listes & tags. Aucun débordement
horizontal ni erreur JavaScript de page sur l'ensemble des parcours.

## Non testé

- **Base réelle** (sandbox sans accès Supabase) : contraintes réelles (P6), latence réelle (P3).
- **Appui long sur un vrai téléphone** (iOS, Android) : P2 est confirmé en émulation CDP. Il
  reste à voir sur appareil si le navigateur émet le `click` final.
- **Barre de sélection** (Reporter, Déplacer, Supprimer en groupe) : sans appui long qui
  fonctionne (P2), pas de parcours complet.
- **Glisser-déposer** pour réordonner (vue « Tout ») et **tirer pour rafraîchir** : gestes
  tactiles fins.
- **Images de tâche** (ajout, agrandissement), **caméra**.
- **Notifications et rappels** (`rappel_minutes`), récurrences (création et avancement d'échéance).
- **Hors ligne** réel : file d'attente et rejeu (`supprimerTacheOuEnFile`), pastille « N en attente ».
- **Bascule à minuit** (« À faire » et « En retard ») et tâches réellement en retard : la fixture
  ne contient qu'une tâche, due aujourd'hui, donc l'onglet « En retard » n'a été vu que vide.
- **Liste longue** (plus de 50 tâches) et fluidité du défilement : la fixture n'a qu'une tâche.
- **Conservation de la vue après navigation** (P9) : déduite du code, pas capturée.
- **Suppression d'une liste qui contient des tâches** (garde-fou du total attendu) et
  **réordonnancement des listes**.
- **Bureau** : l'audit est mobile uniquement.
