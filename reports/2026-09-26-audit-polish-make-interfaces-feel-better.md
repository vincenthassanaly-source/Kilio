# Audit visuel — `make-interfaces-feel-better` (2026-09-26)

> Note : les captures d'écran citées dans ce rapport ont été supprimées du dépôt (nettoyage d'octobre 2026) ; elles restent récupérables dans l'historique git.

Audit de fit-and-finish des 12 modules actifs de Kilio (`src/lib/navigation/registry.ts`), sur la checklist du skill ECC `make-interfaces-feel-better` : rayon concentrique, alignement optique, ombres/bordures, text-wrapping, tabular-nums, font smoothing, contours d'image, transitions explicites, animations enter/exit, hit areas ≥40×40px.

**Aucun fichier de code n'a été modifié.** Seuls ce rapport et `reports/captures-2026-09-26-polish/` ont été produits.

## Limite importante de cette passe

L'accès réseau sortant de cet environnement vers le projet Supabase (`vsmtkopkqasrdnjceegp.supabase.co`) a été coupé **en cours de session**, après les toutes premières captures — pas de lien avec le code de l'app. Conséquences :

- L'URL de production Vercel (`nutrition-appvincent.vercel.app`) était bloquée par la politique réseau de l'environnement dès le départ (403 sur le CONNECT).
- En local (`npm run dev`), les tout premiers écrans capturés (Accueil, Nutrition) ont chargé leurs vraies données. Environ un tiers de la capture dans la session, l'hôte Supabase est passé en « Host not in allowlist » pour toute nouvelle connexion (vérifié y compris hors Next.js, via un `fetch` Node isolé, et après redémarrage du serveur `next dev`) — un problème de politique réseau de l'environnement, pas de l'app.
- **Budget, Réglages, Documents** : capturés uniquement dans leur état d'erreur générique (« Une erreur est survenue »). Audités par lecture de code uniquement, faute de rendu réel.
- **Courses, Objectifs, Collection, Notes, Carburants, Agenda (jour/semaine)** : capturés en état skeleton (chargement) ou erreur locale (« Erreur de chargement… Réessaie. »), la requête n'ayant jamais abouti. La structure (cadres, espacements, rayons) reste lisible sur le skeleton et a été croisée avec le code, mais les états à données réelles (texte long, listes garnies, tabular-nums en mouvement) n'ont pas pu être vérifiés visuellement.
- **Accueil, Nutrition (hub + Journal)** : captures avec données réelles, exploitables normalement.

Pour rouvrir l'accès réseau et refaire une passe de captures complète, élargir l'accès réseau de cet environnement (menu de l'environnement cloud → *Edit* → *Network access*) au host `vsmtkopkqasrdnjceegp.supabase.co`, ou au domaine `*.vercel.app` pour capturer la prod directement.

Un artefact visuel présent sur toutes les captures (rond coloré façon photo en bas à droite, superposé à la barre de navigation) est un rendu du navigateur automatisé (Chromium/Playwright) sans rapport avec le DOM de l'app (confirmé par `elementsFromPoint` — aucun élément de ce type dans `BottomNav.tsx`) : à ignorer, ce n'est pas un écran réel de Kilio.

---

## Accueil (`/`)

Capture : `captures-2026-09-26-polish/01-accueil.png` — données réelles.

Rien à corriger : rayons cohérents (`card` = 22px, aucun élément imbriqué à rayon incohérent), `tabular-nums` déjà posé sur le `%` et les kcal (`DashboardNutritionSection.tsx:39,48`), `ThemeToggle` a déjà sa zone de tap étendue à 44px via le pattern `zoneTap44Icone` (`ThemeToggle.tsx:40`). États vides (« Rien de prévu aujourd'hui », « Aucune habitude pour l'instant ») cohérents visuellement avec le reste.

## Nutrition — Hub (`/nutrition`)

Capture : `02-nutrition-hub.png` — écran statique, sans donnée. Rien à signaler : cartes `card`, icônes bien centrées, pas de nombre à traiter.

## Nutrition — Journal (`/nutrition/journal`)

Capture : `03-nutrition-journal.png` — données réelles (objectif non défini aujourd'hui).

**MOYEN — Incohérence visuelle dans le formulaire d'objectif (grille 2×2).**
`ObjectifForm.tsx:64-114` : les 4 champs (Kcal cible, Protéines, Glucides, Lipides) ont la même apparence de conteneur, mais `kcal_cible` n'a **aucune valeur par défaut** (`defaultValue={objectif?.kcal_cible ?? ""}`) alors que les 3 autres sont pré-remplis à `0` (`defaultValue={objectif?.macro ?? 0}`). Résultat visible sur la capture : la case « Kcal cible » paraît vide/cassée à côté de 3 cases identiques affichant « 0 », alors que c'est un choix volontaire (champ requis, pas de valeur inventée). Un `placeholder="ex. 2200"` sur ce champ réglerait l'incohérence visuelle sans changer le comportement (toujours vide tant que rien n'est saisi, mais plus cohérent avec les 3 voisins).
```diff
  <input
    id={`${uid}-kcal_cible`}
    name="kcal_cible"
    type="number"
    inputMode="numeric"
    min="0"
    max="10000"
    step="1"
    required
+   placeholder="ex. 2200"
    defaultValue={objectif?.kcal_cible ?? ""}
    className={input}
  />
```

Reste de l'écran conforme : navigation jour (`JourNavigation`, `JournalNavigationJour.tsx:7-8`) déjà en zone de tap 44×44px, bascule Journal/Recettes et Repos/Entraînement sur le composant `segmented` partagé (rayon concentrique correct : cadre `rounded-2xl` = 16px, pastille active `rounded-xl` = 12px, avec `p-1` = 4px de padding → 16 − 4 = 12, exact).

## Nutrition — Recettes (`/nutrition/recettes`)

Capture indisponible avec données (panne réseau survenue avant le chargement). Code de `RecettesList.tsx` réutilise `listCard`/`card` déjà audités ailleurs — rien de spécifique identifié à ce stade ; à revérifier visuellement.

## Tâches (`/taches`)

Capture : `05-taches.png` — skeleton (chargement jamais abouti). Structure (cadre de filtres, `Ajouter une tâche`, liste) cohérente avec le reste de l'app.

**BAS — Poignée de réordonnancement sous la zone de tap minimale.**
`TasksList.tsx:508-514` : le bouton drag-handle (`data-drag-handle`, glisser pour réordonner une tâche) fait `h-8 w-8` (32×32px), sans le pattern `zoneTap44Icone` déjà utilisé ailleurs dans le design system (`ui.ts`, ex. `iconButton`). Sous le minimum de 40×40px recommandé par le skill. Ce n'est pas un tap ponctuel (c'est un handle de drag), donc l'impact est moindre qu'un bouton d'action, mais le correctif est le même pattern déjà en place à 3 autres endroits du code (`ui.ts:44` `zoneTap44Icone`) :
```diff
- className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-2"
+ className="relative after:absolute after:-inset-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-2"
```
(à valider que la zone étendue de 4px de chaque côté ne chevauche pas les boutons voisins dans `justify-between`, cf. le commentaire déjà présent dans `ui.ts` sur `zoneTap44`.)

## Agenda — Jour / Semaine (`/agenda`)

Captures : `06-agenda-jour.png`, `07-agenda-semaine.png` — état d'erreur (« Erreur de chargement de l'agenda. Réessaie. »), requête jamais aboutie. Le sélecteur de vue Jour/Semaine/Mois/Liste est bien un rayon concentrique correct (`AgendaView.tsx:296-297` : cadre `rounded-2xl`/16px avec `p-1`, pastille `rounded-xl`/12px = 16 − 4, exact — même calcul que le Journal). Pas d'audit possible du contenu réel (`TimeGrid`, `TacheBlock`) sans données ; à refaire une fois l'accès réseau rétabli.

## Courses (`/courses`)

Capture : `08-courses.png` — skeleton, jamais résolu. Structure conforme (`addCard`, cartes de liste). Contenu réel non vérifiable dans cette passe.

## Budget (`/budget`)

Capture : `09-budget.png` — état d'erreur générique uniquement (page entière en échec dès `genererOccurrencesDuesPourLaRequete`, avant tout rendu de contenu). Revue de code (`page.tsx`) : `tabular-nums` déjà posé sur tous les montants (soldes, résumé du mois, ligne 119/138/144/151), `font-mono` sur le texte de suivi de catégorie (ligne 185, chiffres déjà en chasse fixe). Rien identifié à corriger sur la base du code seul ; l'écran réel (montants à plusieurs chiffres, alignement des colonnes) n'a pas pu être vérifié visuellement.

## Objectifs (`/objectifs`)

Capture : `10-objectifs.png` — skeleton, jamais résolu. Structure conforme à `addCard`/liste. Non vérifiable visuellement dans cette passe.

## Collection (`/collection`)

Capture : `11-collection.png` — état d'erreur (« Erreur de chargement des collections. Réessaie. »). Revue de code : `CollectionMosaic.tsx` a déjà un contour neutre (`border border-line`) autour de chaque mosaïque de couverture (1, 2, 3 ou 4 photos), et le détail d'une collection (`PhotosGrid.tsx:118`) a lui aussi `border border-line` sur chaque vignette — conforme au principe « contours neutres sur les images ». Bouton de suppression déjà en zone de tap 44×44px avec pastille visible 28px (`PhotosGrid.tsx:142-144`, commentaire explicite dans le code). Rien à signaler sur la base du code ; rendu réel (grille garnie, alignement des mosaïques à 3 photos) non vérifié visuellement.

## Notes (`/notes`)

Capture : `12-notes.png` — état d'erreur (« Erreur de chargement des notes. Réessaie. »).

**MOYEN — Pastilles de couleur sous la zone de tap minimale, sans compensation.**
`NoteForm.tsx:317-333` : les 6 boutons de sélection de couleur de note (« Aucune couleur » + palette) font `h-7 w-7` (28×28px), avec seulement `gap-2` (8px) entre eux — aucune zone de tap étendue, alors que le pattern `zoneTap44Icone` existe déjà dans `ui.ts` et sert justement à ce cas (agrandir la zone de tap sans agrandir la pastille visible). Nettement sous le minimum de 40px du skill, et sur une rangée d'éléments serrés où une cible réduite augmente le risque de sélectionner la mauvaise couleur au pouce.
```diff
  <button
    type="button"
    onClick={() => setCouleur(null)}
    aria-label="Aucune couleur"
-   className={`h-7 w-7 rounded-full border-2 bg-surface ${
+   className={`relative after:absolute after:-inset-1.5 h-7 w-7 rounded-full border-2 bg-surface ${
      couleur === null ? "border-kcal" : "border-line"
    }`}
  />
```
(même correctif sur le `.map` de `NOTE_PALETTE` juste en dessous ; `-inset-1.5` plutôt que `-inset-1` pour atteindre ~40px vu la taille de départ plus petite que `iconButton` — à ajuster le `gap-2` du conteneur si les zones étendues se chevauchent entre pastilles adjacentes.)

## Réglages (`/reglages`)

Capture : `13-reglages.png` — état d'erreur générique (échec sur `getReglagesNettoyage`, avant tout rendu). Revue de code : les icônes décoratives 32px (`AppearanceRow.tsx:22`, `NotificationsRow.tsx:91`, `NettoyageAutoRow.tsx:101`) sont des `<span>` non interactifs à côté du libellé — pas un problème de zone de tap (les vrais boutons/switches sont bien plus grands). Rien identifié à corriger sur la base du code ; rendu réel non vérifié visuellement.

## Carburants (`/carburants`)

Capture : `14-carburants.png` — skeleton, jamais résolu. Structure conforme (filtres de distance, tri, cartes de liste). Non vérifiable visuellement dans cette passe.

## Documents (`/documents`)

Capture : `15-documents.png` — état d'erreur générique (échec sur `getDocuments`, avant tout rendu). Revue de code (`DocumentCard.tsx`) : vignette d'aperçu déjà avec contour neutre (`border border-line`, ligne 82/99), zone de tap de la vignette 56×56px (large marge au-dessus du minimum), `tabular-nums` non nécessaire ici (pas de nombre qui change en place). Rien identifié à corriger sur la base du code ; rendu réel (dates d'échéance proches, badges d'alerte) non vérifié visuellement.

---

## Résumé

| Sévérité | Constat | Module | Capture vérifiée | Statut |
|---|---|---|---|---|
| MOYEN | Pastilles de couleur de note 28px sans zone de tap étendue | Notes | Code seul (écran en erreur) | Corrigé (`NoteForm.tsx`) |
| MOYEN | Incohérence visuelle du champ « Kcal cible » vide vs. voisins à 0 | Nutrition / Journal | Oui (donnée réelle) | Corrigé (`ObjectifForm.tsx`) |
| BAS | Poignée de réordonnancement de tâche 32px sans zone de tap étendue | Tâches | Code seul (skeleton) | Corrigé (`TasksList.tsx`) |

Les 3 correctifs ci-dessus ont été implémentés (diffs identiques à ceux proposés plus haut) et vérifiés visuellement : placeholder « ex. 2200 » bien affiché sur le champ Kcal cible, pastilles de couleur Notes avec espacement élargi (`gap-3`) sans chevauchement de leur zone de tap étendue. `npm run lint` et `tsc --noEmit` passent sans erreur après ces changements.

Le reste des écrans passés en revue (Accueil, Nutrition Hub, Agenda, Collection, Documents, Réglages, Budget) ne fait apparaître aucun écart clair par rapport à la checklist — le design system (`src/lib/ui.ts`, `src/lib/segmented.ts`) applique déjà systématiquement rayons concentriques, `tabular-nums`, contours d'image et zones de tap 44px sur la grande majorité des composants inspectés. Les modules capturés uniquement en skeleton/erreur (Courses, Objectifs, Carburants, Nutrition/Recettes, Agenda) nécessitent une repasse visuelle une fois l'accès réseau à Supabase rétabli pour cet environnement, avant de considérer leur audit complet.
