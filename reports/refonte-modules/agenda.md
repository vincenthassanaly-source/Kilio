# Refonte modules — Agenda (cohérence interne)

Date : 2026-11-14. Lecture seule (aucun code ni base modifié). Captures : `reports/audit/agenda/ecrans/` (repos, clair+sombre) et `reports/audit/agenda/parcours/refonte-*` (3 parcours, scénarios dans `reports/audit/agenda/scenarios-refonte/`). Faux Supabase uniquement, sans `--reset`.

## Résumé

1. Le module est globalement cohérent (un seul `/agenda`, 4 vues en segmenté, FAB unique, patrons Supprimer/Enregistrer conformes au GLOSSARY).
2. Le principal défaut de parcours : la vue n'est pas mémorisée (toujours « Jour ») et la grille Jour/Semaine s'ouvre sur l'heure courante sans indice des éléments situés plus tôt.
3. La Liste est un doublon partiel de `/taches` (mêmes `TaskCard`, « Sans date », archivées) et la seule vue sans en-tête de période ni retour à aujourd'hui.
4. Gestes cachés : création d'événement par appui long (seul indice : un aria-label), aucune création de tâche à l'heure depuis la grille.
5. Vocabulaire : deux écarts mineurs au GLOSSARY (fermeture de formulaire par « Fermer » seul, FAB « Événement / Tâche » sans verbe), pas de contradiction avec les choix déjà tranchés.

## Inventaire des écrans

| Route / état | Rôle | Fichier |
|---|---|---|
| `/agenda` (seule route ; `?date=AAAA-MM-JJ`, `?tache=<id>` en deep-link, nettoyés de l'URL) | Shell serveur + `AgendaView` (état local `view`, `selectedDate`) | `agenda/page.tsx`, `AgendaView.tsx:68` |
| Vue Jour (défaut) | Puces (journée entière, avant 6 h, tâches sans heure) + grille horaire zoomable + `TaskCard` du jour + « Tâches archivées » | `DayView.tsx` |
| Vue Semaine | Grille 7 colonnes, ~3,5 jours visibles, tap colonne = Jour | `WeekView.tsx` |
| Vue Mois | Grille de pastilles (tâche, événement, férié, jour travaillé), tap = Jour | `MonthView.tsx` |
| Vue Liste | Jours groupés (événements + `TaskCard`), « Jours passés (n) » replié, « Sans date », « Tâches archivées » ; fenêtre événements −30/+90 j | `ListView.tsx` |
| Modale « Nouvelle tâche » (`AddTaskForm`, chargé depuis `/taches`) | Création de tâche, échéance pré-remplie | `AgendaView.tsx:460` |
| Modale « Nouvel événement / Modifier l'événement » (`EvenementForm`, de `_accueil`) | Création/édition/suppression d'événement | `AgendaView.tsx:478` |
| Hors routes : `api/agenda/feed.ics` (flux ICS), jours fériés (`actions/jours-feries.ts`, informatifs) | Export / donnée | — |

Aucun sous-écran orphelin : pas de page `/agenda/*`. L'édition d'une tâche passe par `TaskCard` (composant de `/taches`).

## Constats

### Axe A — Parcours et hiérarchie

- **A1 (moyenne) — La vue n'est pas retenue.** `useState<ViewKey>("jour")` (`AgendaView.tsx:111`). Parcours `refonte-vues-mois-liste` : Mois → Liste → Semaine, puis retour sur `/agenda` = Jour (capture `13-screenshot.png`). Un usage « Mois en premier » coûte 2 taps à chaque ouverture.
- **A2 (moyenne) — Grille Jour/Semaine : éléments plus tôt invisibles, sans indice.** À 19 h, l'ouverture cale la grille vers 16 h (`ecrans/agenda.clair.png`, `parcours/refonte-vues-mois-liste/11-screenshot.png`) : le « Rendez-vous e2e » de 09:00 (visible en Liste, `07-screenshot.png`) n'apparaît pas, et la Jour affiche « Aucune tâche… seulement des événements » sans le montrer. Le scroll initial ne protège que les blocs coupés (`TimeGrid.tsx`, `useInitialScroll`). Choix « scroll sur maintenant » tranché (lot 1) : on ne le remet pas en cause, seulement l'absence de repère.
- **A3 (moyenne) — Les tâches du jour sont sous la grille.** `max-h-[55vh]` pour la grille (`DayView.tsx:249`) puis `TaskCard` : sur 390 px la liste n'est visible qu'après scroll (captures `ecrans/`, bas de page masqué par la barre du bas). Le geste fréquent « cocher/lire mes tâches du jour » est moins exposé que la grille, rarement utile pour des tâches sans heure.
- **A4 (basse) — Gestes cachés.** Création d'événement à l'heure : appui long 450 ms (`DayView.tsx:35,191-206`), indice uniquement dans l'aria-label de la région (`:248`) ; rien de visible. Pincement pour zoomer idem. Les tâches ne peuvent pas être créées depuis la grille (la FAB pré-remplit la date, pas l'heure).
- **A5 (basse) — Nombre de taps des gestes fréquents** (mesuré) : ajouter une tâche = 4 taps (FAB, Tâche, titre, Ajouter ; `refonte-ajout-tache-fab`, 9 étapes OK, persistance après reload OK) ; ajouter un événement = FAB, Événement, titre (+heure), Ajouter ; voir un jour du mois = 2 taps (Mois, jour) ; revenir à aujourd'hui = 1 tap (visible seulement hors période). Raisonnable. Ordre du menu FAB : « Événement » en premier et focalisé (`AgendaView.tsx:434-454`) alors que la tâche est l'objet le plus fréquent.
- **A6 (basse) — Liste sans en-tête de période.** Seule vue sans `PeriodHeader` ni « Aujourd'hui » ; son défilement part du premier jour passé replié, pas d'ancrage sur aujourd'hui (capture `07-screenshot.png`). Les jours passés (30 j) sont repliés par défaut, ce qui est cohérent avec les archivées.

### Axe B — Vocabulaire et gestes

- **B1 (basse) — Fermeture des formulaires par « Fermer » uniquement.** Le GLOSSARY réserve « Fermer » aux feuilles qui n'annulent rien et définit « Annuler » pour fermer un formulaire sans rien enregistrer. Les modales Agenda n'ont que la croix `aria-label="Fermer"` (`components/Modal.tsx:69`) ; le parcours `refonte-liste-edition` a échoué à l'étape 6 car aucun bouton « Annuler » n'existe (vrai constat de conception, pas un artefact). Écart partagé par toute l'app (voir Pistes inter-modules).
- **B2 (basse) — FAB : « Événement » / « Tâche ».** Boutons d'entrée sans « Ajouter » (`AgendaView.tsx:443,453`) ; le groupe est étiqueté « Ajouter » (`:433`) et le FAB « Ajouter une tâche ou un événement » (`:410`), donc acceptable ; à signaler face à la charte « Ajouter un/une X ».
- **B3 — Conformes** : titres « Nouvelle tâche » / « Nouvel événement » / « Modifier l'événement » ; bouton « Ajouter » en création, « Enregistrer » en modification, « Supprimer » (`EvenementForm.tsx:255-259`) ; suppression d'événement avec toast « « X » supprimé · Annuler » via `supprimerAvecAnnulation` (`AgendaView.tsx:276`), sans confirmation. Jour/Semaine/Mois/Liste en segmenté commun.
- **B4 (basse) — Libellés de période hétérogènes** : Jour « Samedi 14 novembre », Semaine « 9 nov. – 15 nov. 2026 », Mois « Novembre 2026 », Liste « Aujourd'hui · Samedi 14 novembre 2026 » (année toujours affichée en Liste, omise en Jour pour l'année en cours : `DayView.tsx:216` vs `ListView.tsx:78`). Messages vides : « Journée libre : rien de prévu. » (Jour), « Rien de prévu cette semaine. » / « …ce mois-ci. », « Rien d'agendé pour l'instant. Ajoute… avec le bouton +. » (Liste) — trois formulations pour la même idée.
- **B5 (basse) — « Tâches archivées »** désigne des tâches cochées ; cohérent avec `/taches` (`TasksList.tsx:1045`) et avec l'archivage tranché (rapport 2026-09-05) ; la charte ne l'interdit que pour Courses (« À prendre / Pris »). Pas d'action.
- **B6 (basse) — Jours fériés** : pastille `FerieBadge` en Jour/Liste, soulignement en Semaine/Mois (+ `sr-only`). Conforme au choix « purement informatif » (PRODUCT.md:27) ; pastille seulement dans deux vues sur quatre.

### Axe C — Cohésion fonctionnelle

- **C1 (moyenne) — Doublon partiel Liste Agenda / `/taches`.** `ListView` réimplémente regroupement par échéance, « Sans date » et « Tâches archivées » avec les mêmes `TaskCard` (`ListView.tsx:47-160`, `TasksList.tsx:1042`). Différences : la Liste ajoute les événements et les fériés. Deux entrées pour « toutes mes tâches par date » ; l'effet est un second chemin d'édition et deux fenêtres temporelles (tâches sans limite, événements −30/+90 j, annoncé en pied de page `ListView.tsx:162`).
- **C2 (basse) — Jour d'agenda vs frise d'Aujourd'hui.** `DayTimeline` (Aujourd'hui) réutilise `TimeGrid`/`TacheBlock` : le jour courant existe à deux endroits, la frise étant volontairement un coup d'œil (commentaire `DayTimeline.tsx:27`). Cohérent, à garder, mais le lien vers l'Agenda doit rester évident.
- **C3 (basse) — Édition d'un événement dans `_accueil`.** `EvenementForm`/`EvenementBlock` vivent dans `_accueil` alors que l'Agenda en est le propriétaire fonctionnel (import inverse `AgendaView.tsx:23`, et `DayTimeline` importe `../agenda/TimeGrid`). Dépendance croisée, pas un écran orphelin.
- **C4 (basse) — Planning travail** (créneaux, exceptions) est affiché dans Jour/Semaine/Mois mais n'a aucun point d'entrée ni d'édition dans le module (écrit hors app, `AgendaView.tsx:84-89`) : donnée « fantôme » côté UI (bande de fond sans légende en Jour).
- Pas d'écran orphelin ; flux ICS et deep-links (`?date=`, `?tache=`, `from=revue`) cohérents.

## Propositions

**P1 — Mémoriser la dernière vue.** Persister `view` (localStorage avec try/catch, ou préférence) et la relire à l'init ; `?date=` continue d'ouvrir en Jour. Effet : −2 taps pour qui préfère Mois/Liste (A1). Effort S. Risque faible (hydratation : lire dans un effet ou `useSyncExternalStore`). Fichiers : `AgendaView.tsx`. Dépend de : rien. Note : ne contredit aucun rapport (la Jour par défaut n'est documentée nulle part comme choix).

**P2 — Indice d'éléments hors champ dans la grille Jour/Semaine.** Petite pastille cliquable « ↑ 1 événement plus tôt » (ou compteur) en haut de la grille quand des blocs sont au-dessus de la zone visible ; ne change pas le scroll initial. Effet : plus de « journée vide » trompeuse (A2). Effort M. Risque moyen (scroll/zoom, a11y). Fichiers : `TimeGrid.tsx`, `DayView.tsx`, `WeekView.tsx`. Dépend de : rien.

**P3 — Exposer les tâches du jour avant la grille quand il n'y a pas d'événement horaire.** Option : réduire la grille (ex. `max-h` adaptatif ou grille repliable) et remonter `TaskCard` ; ou ancre « Tâches du jour » sous le sélecteur. Effet : gestes fréquents (cocher) en 1 écran (A3). Effort M. Risque moyen (équilibre visuel Jour, lot 2 lisibilité). Fichiers : `DayView.tsx`. Dépend de : arbitrage produit.

**P4 — Rendre l'appui long découvrable.** Indice court affiché une fois (ou sous la grille : « Appui long pour ajouter un événement ») et/ou « Ajouter ici » à l'heure ; envisager le choix Tâche/Événement au créneau. Effet : A4. Effort S pour l'indice, M pour la tâche à l'heure. Risque faible. Fichiers : `DayView.tsx`, `AgendaView.tsx`. Dépend de : rien.

**P5 — Harmoniser la Liste : en-tête et ancrage sur aujourd'hui.** Ajouter un titre de période/« Aujourd'hui » d'ancrage (ou scroll initial sur aujourd'hui) et aligner année affichée (A6, B4). Effort S. Risque faible. Fichiers : `ListView.tsx`, `date-utils.ts`. Dépend de : rien.

**P6 — Unifier les messages vides et formats de titre.** Une formule commune (« Rien de prévu ce jour / cette semaine / ce mois-ci / pour l'instant ») et règle d'année identique (B4). Effort S. Risque nul. Fichiers : `DayView.tsx`, `WeekView.tsx`, `MonthView.tsx`, `ListView.tsx`. Dépend de : rien.

**P7 — Statuer sur la Liste vs `/taches` (C1).** Deux options : (a) garder la Liste mais retirer « Sans date » et « Tâches archivées » (déjà dans `/taches`) pour qu'elle reste « ce qui est daté » ; (b) la conserver telle quelle et documenter la complémentarité dans PRODUCT.md. Effet : un seul chemin pour les tâches sans date. Effort S (a) / S (b). Risque moyen (a) : perte d'un raccourci. Fichiers : `ListView.tsx`, `PRODUCT.md`. Dépend de : décision de Vincent, et de la décision inter-modules sur la Liste de tâches.

**P8 — Charte de fermeture des formulaires (B1/B2).** Soit ajouter « Annuler » à côté de « Ajouter/Enregistrer » dans `EvenementForm`/`AddTaskForm`, soit amender le GLOSSARY pour dire que la croix « Fermer » est le patron des modales. FAB : renommer les choix en « Ajouter un événement / Ajouter une tâche » (court : garder « Événement / Tâche » sous le groupe « Ajouter » et le dire dans le GLOSSARY). Effort S. Risque faible. Fichiers : `GLOSSARY.md`, `EvenementForm.tsx`, `AgendaView.tsx`. Dépend de : P-inter-modules (Modal partagée).

**P9 (basse) — Remonter `EvenementForm`/`EvenementBlock` dans `agenda/`** (C3), `_accueil` n'important que depuis `agenda/`. Effort S. Risque faible (imports, tests `EvenementForm.test.tsx`). Fichiers : `_accueil/Evenement*.tsx`, `agenda/*`. Dépend de : rien.

## Pistes inter-modules

- Modal commune : croix « Fermer » partout contre « Annuler » dans le GLOSSARY (touche tous les formulaires).
- Liste de l'Agenda vs liste de `/taches` : un seul regroupement par date/archivées à factoriser.
- Frise du jour d'Aujourd'hui vs vue Jour (réutilisation de `TimeGrid`).
- Planning de travail : aucune UI d'édition (écrit via skill) ; à rattacher à un module ou à Réglages.
- Revue renvoie vers `/agenda?date=…&from=revue` (OK) ; la recherche globale ouvre `?date=`.
- Ordre/épinglage de l'Agenda dans la barre du bas (`navigation/registry.ts`).

## Ce qui n'a pas pu être testé

- Artefacts du faux Supabase (pas de bug app) : 404 `/_vercel/speed-insights/script.js` ; requêtes `POST /agenda` / `GET …?_rsc=` en `ERR_ABORTED` pendant les navigations/rechargements rapides ; heure « 09:00 AM » (locale du navigateur de test) ; données minimales (1 événement, 2 tâches, aucun férié visible en Semaine/Mois).
- Vrai constat : absence de bouton « Annuler » (étape 6 de `refonte-liste-edition`).
- Non testé : tap sur un jour du Mois (mon sélecteur `role=button[name=/14/]` n'a pas correspondu au libellé `monthCellAriaLabel` : échec de mon scénario, pas de l'app), appui long de création, pincement, swipe de période, Semaine peuplée, thème sombre (captures au repos seulement), flux ICS, notifications `?tache=`, base réelle, lecteur d'écran.
- Environnement : les scripts du skill pointaient un Chromium absent (`chromium_headless_shell-1194`) ; exécutés via une copie dans le scratchpad avec le binaire 1243 installé, sans toucher au skill. Les captures `ecrans/agenda.*.png` ont été régénérées (écrasement des anciennes).

Résumé : (1) module cohérent mais vue non mémorisée et grille sans repère d'éléments hors champ ; (2) Liste en doublon partiel de `/taches` ; (3) gestes cachés (appui long) ; (4) écarts GLOSSARY mineurs : « Fermer » sans « Annuler », FAB sans verbe ; (5) 9 propositions, dont P1, P5, P6 faciles (S) et P3/P7 à arbitrer. Rapport : `/home/user/Kilio/reports/refonte-modules/agenda.md`.
