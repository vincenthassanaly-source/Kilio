# Refonte de cohérence : module Tâches (2026-11-14)

Lecture seule. Banc : app :3100, faux Supabase :54321 (sans `--reset`). Captures : `reports/audit/taches/ecrans/` (4, mobile clair et sombre) et `reports/audit/taches/parcours-refonte/` (4 parcours). Critique impeccable sautée, comme demandé.

## Résumé
1. Le module est cohérent dans ses gestes de base : cocher en 1 tap, ajouter en 3 taps (FAB, titre, « Ajouter »), suppression différée avec « Annuler », libellés conformes au GLOSSARY dans l'ensemble.
2. Le point faible est la hiérarchie : « Listes & tags » est un lien discret en bas d'une liste potentiellement longue, et les tags n'ont aucune utilité de consultation (ni filtre, ni vue).
3. Trois sens de « du jour » (onglet « À faire », pastille/case « Tâche du jour » à suppression automatique, écran Aujourd'hui) et deux retards (onglet « Retard », carte « En retard » d'Aujourd'hui) brouillent le vocabulaire.
4. Les écrans de gestion (listes, tags) divergent légèrement des écrans de tâches : style du bouton « Annuler », points de suspension, ordre par flèches contre glisser-déposer.
5. Neuf propositions, surtout S : aucune ne remet en cause un choix documenté, deux le frôlent (P3, P7, signalés).

## Inventaire des écrans
| Route / surface | Rôle |
|---|---|
| `/taches` (`page.tsx`, `TachesView.tsx`) | Liste des tâches : 4 vues segmentées (À faire / Retard / 7 jours / Tout), recherche, sélecteur de liste, feuille « Filtres et tri » (priorité, tri), section « Tâches archivées » repliée, lien « Gérer les listes » |
| Feuille « Nouvelle tâche » (`QuickAddFab` en mode `directTask` + `AddTaskForm`) | Création : titre, liste, échéance + 4 raccourcis, « Plus d'options » (heure, rappel, notes, images, tags, récurrence, « Tâche du jour »…) |
| Carte étendue (`TaskCard` en édition, `AddTaskForm enLigne`) | Édition en place (tap sur le titre), « Annuler » / « Supprimer » ; sous-tâches via pastille « + sous-tâches » |
| Barre de sélection (`SelectionBar`) | Appui long sur une carte : Reporter, Changer de liste, Supprimer, Tout sélectionner |
| `/taches/listes` (`listes/page.tsx`) | « Listes & tags » : ajouter, modifier, réordonner (flèches), supprimer les listes ; ajouter, modifier, supprimer les tags |

Il n'y a aucun écran orphelin dans le module : deux routes seulement, `/taches/listes` n'est atteignable que par le lien de `TachesView.tsx:529` (et le retour `BackLink` vers `/taches`).

## Constats

### A. Parcours et hiérarchie
- **A1 (moyenne)** : l'accès à la gestion des listes et tags est un lien texte « Gérer les listes » placé après la dernière carte et la section archivées (`TachesView.tsx:527-531`, capture `taches.clair.png`). En vue « Tout » avec beaucoup de tâches (73 actives dans l'audit du 18/09), il faut tout faire défiler. Le libellé dit « listes » alors que l'écran s'intitule « Listes & tags » (`listes/page.tsx:15`) : les tags sont invisibles depuis `/taches`.
- **A2 (moyenne)** : les tags sont créés (formulaire de tâche, `/taches/listes`) et affichés en pastilles, mais jamais exploitables : pas de filtre par tag (filtres = priorité et tri, `TachesView.tsx:442-469`). Seule la recherche texte les trouve (`TachesView.tsx:171`). Vérifier d'abord leur usage réel : l'audit du 18/09 indiquait 0 tag en base.
- **A3 (basse)** : la liste est un filtre intégré à la barre de recherche (`ListeSelect`, `TachesView.tsx:410`) alors que priorité et tri sont dans une feuille : deux emplacements de filtre. Choix documenté (11/11, « barre unique »), à ne pas remettre en cause, mais le sélecteur de liste n'offre aucun raccourci « Gérer les listes ».
- **A4 (moyenne)** : « Reporter » et « Changer de liste » n'existent que dans la barre de sélection (appui long, `SelectionBar.tsx:190-207`) : 4 taps minimum pour reporter une tâche (appui long, Reporter, échéance), sans indice visible en tactile (le bouton de sélection n'existe qu'au survol sur ordinateur, `TasksList.tsx:750-764`). Reporter est pourtant le geste fréquent des tâches en retard. Il est déjà exposé ailleurs : puces de report dans la carte « En retard » d'Aujourd'hui et la Revue.
- **A5 (basse)** : la création passe par une feuille modale mais la modification par une carte dépliée en place avec 15 champs (`TasksList.tsx:576-613`, hack `mb-28`) : deux surfaces pour le même formulaire. Constat factuel ; l'inline est un choix ancien (audit 30/08), non contesté ici.
- **A6 (basse)** : réordonner = glisser-déposer des tâches, uniquement en vue « Tout » sans recherche, tri manuel ni filtre priorité (`TachesView.tsx:240`) ; poignée absente sinon, sans explication. Listes et sous-tâches se réordonnent par flèches (`ListesManager.tsx:122-140`, `TasksList.tsx:221-238`).
- **A7 (basse, positif)** : le nombre de taps des gestes fréquents est bon : ajouter 3 taps (échéance préremplie selon la vue, capture `r-creer-fab/03`, `echeanceParDefaut`), cocher 1, éditer 1, sous-tâche 2 + saisie (pastille puis Entrée).

### B. Vocabulaire et gestes
- **B1 (moyenne)** : « du jour » a trois sens. Onglet « À faire » (retard + aujourd'hui, `TachesView.tsx:72`), pastille « Tâche du jour » (`TasksList.tsx:721`, case `AddTaskForm.tsx:604-609`) qui signifie en réalité « supprimée automatiquement si non cochée », et l'écran Aujourd'hui (section « Tâches »). Le nom de la case n'annonce pas la destruction ; l'aide n'est visible qu'une fois dans « Plus d'options ». Le rappel de la suppression (« Les tâches du jour non cochées sont supprimées… », `TasksList.tsx:1004`) est un paragraphe permanent au-dessus de la liste.
- **B2 (basse)** : « Retard » (onglet, `TachesView.tsx:73`) / « En retard » (carte, `TasksList.tsx:697`, messages `TachesView.tsx:326`, section Aujourd'hui, Revue). Le GLOSSARY ne tranche pas (« retards à replanifier » pour la Revue ; « jamais “retard” » pour le score).
- **B3 (basse)** : « Tâches archivées (N) » (`TasksList.tsx:1045`, et Agenda) désigne en fait les tâches faites, alors que le geste est « cocher » et les états de Courses sont « à prendre / pris ». Le GLOSSARY ne définit pas d'état pour les tâches. Terme répété dans Agenda : à trancher une fois, au niveau charte.
- **B4 (basse)** : boutons « Annuler » de fermeture de formulaire : `textButton` dans la carte de tâche (`TasksList.tsx:599`), mais `text-label text-ink-2 underline` écrit à la main dans `ListesManager.tsx:51`, `TagsManager.tsx:23`, `AddListeToggle.tsx:34` (capture `r-liste-tag/15`). Même libellé (conforme à la charte), deux styles.
- **B5 (basse)** : états d'attente écrits avec trois points ASCII « Enregistrement... » (`AddTaskForm.tsx:803`, `AddListeForm.tsx:70`, `AddTagForm.tsx:62`) mais « Ajout… » avec le caractère ellipse (`TasksList.tsx:267`) et « Rechercher… ».
- **B6 (basse)** : suppression d'une sous-tâche par une croix rouge sans texte (`TasksList.tsx:239-247`, capture `r-carte/14`), alors que tout le reste du module écrit « Supprimer » en toutes lettres ; chaque sous-tâche porte en plus trois icônes (monter, descendre, supprimer), visuellement lourd pour un geste rare. Le patron suppression différée + toast est respecté (conforme au GLOSSARY).
- **B7 (conforme)** : « Ajouter » en création, « Enregistrer » en modification (`AddTaskForm.tsx:803`, listes, tags), titres « Nouvelle tâche » / boutons d'entrée « Ajouter une liste / un tag » avec sous-titre, « Supprimer » sans confirmation avec annulation 6 s (tâche, liste, tag, sous-tâche, sélection), « Annuler » pour fermer. Les scénarios existants (`creer-tache.json`) citent encore « Créer » : périmés, pas un défaut du code.
- **B8 (basse)** : le suffixe « (optionnel) » apparaît sur « Échéance (optionnel) » et « Couleur (optionnel) » mais pas sur les autres champs facultatifs (heure, notes) ; sans règle écrite.

### C. Cohésion fonctionnelle
- **C1 (moyenne)** : « Listes & tags » a une vraie structure de module (route, `loading.tsx`, formulaires) mais un poids très faible et il contient une opération destructrice lourde : supprimer une liste supprime toutes ses tâches (`ListesManager.tsx:74-82`). Garde-fous déjà en place (toast avec nombre de tâches, annulation, contrôle serveur du total) ; ne pas les toucher.
- **C2 (basse)** : la case « Tâche du jour » (suppression automatique à minuit) est une fonction de rétention de tâche, rare (7 sur 163 le 18/09), logée au même niveau que notes et images dans « Plus d'options ». Elle est plus proche d'une règle « tâche éphémère » que d'un champ.
- **C3 (basse)** : doublons de surface avec d'autres modules : retard et tâches du jour dans Aujourd'hui, retards et reports dans la Revue, tâches du jour et archivées dans l'Agenda (`ArchivedTasksSection` réutilise `TaskCard`), saisie en langage naturel de l'accueil. Voir pistes inter-modules.
- **C4 (basse)** : fichiers `TasksList.tsx` (1080 lignes) et `AddTaskForm.tsx` (808) concentrent plusieurs responsabilités (carte, sous-tâches, glisser-déposer, archivées ; champs, images, tags, récurrence). Utile à savoir avant P3 et P6 ; pas un constat de cohérence utilisateur.

## Propositions

**P1. Rendre « Listes & tags » découvrable.** Remplacer le lien de fin d'écran par une entrée en tête d'écran (icône engrenage / « Listes et tags » dans la ligne de la barre de recherche ou ligne sous le titre) et renommer en « Listes et tags » partout (lien, titre, `BackLink`). Effet : accès en 1 tap, sans défilement ; vocabulaire aligné sur l'écran. Effort S. Risque : bas (densité de l'en-tête sur 390 px, déjà serré, à vérifier). Fichiers : `TachesView.tsx`, `listes/page.tsx`, `listes/loading.tsx`. Dépend de : rien.

**P2. Exposer « Reporter » sur la carte.** Ajouter un geste visible de report (puce « Reporter » sur les cartes en retard seulement, comme dans la carte « En retard » d'Aujourd'hui, en réutilisant `reporterEtAnnuler` de `SelectionBar.tsx`) au lieu de n'avoir que la sélection par appui long. Effet : 2 taps au lieu de 4 pour le geste le plus fréquent des tâches en retard, mêmes puces qu'Aujourd'hui et la Revue. Effort M. Risque : encombrement des cartes (limité aux cartes en retard). Fichiers : `TasksList.tsx`, `SelectionBar.tsx` (extraction du sélecteur de report). Dépend de : décision inter-module sur les puces de report partagées (voir pistes).

**P3. Clarifier « Tâche du jour ».** Renommer la case et la pastille en « À supprimer ce soir » ou « Éphémère » (libellé à trancher avec Vincent), mettre l'aide sous le titre de la case, et déplacer le paragraphe permanent de `TasksList.tsx:1004` vers l'aide. Effet : plus de collision avec « À faire » et Aujourd'hui, la destruction est annoncée par le nom. Effort S. Risque : moyen car touche un choix documenté (`reports/2026-09-13-taches-programme-jour.md` fixe « Tâche du jour ») : à valider explicitement. Fichiers : `AddTaskForm.tsx`, `TasksList.tsx`, tests associés. Dépend de : rien.

**P4. Unifier « Retard ».** Trancher une forme (« En retard » partout, onglet inclus) et l'inscrire au GLOSSARY ; l'onglet « En retard N » tient en pastille déjà prévue (`TachesView.tsx:366-380`) mais la largeur du segmenté est limitée : vérifier à 390 px (l'abréviation « Retard » vient probablement de là). Effet : même mot dans Tâches, Aujourd'hui, Revue. Effort S. Risque : bas. Fichiers : `TachesView.tsx`, `GLOSSARY.md`. Dépend de : rien.

**P5. Définir l'état « fait » des tâches dans la charte.** Choisir « Terminées » (ou conserver « Archivées ») et l'ajouter à GLOSSARY, puis aligner Tâches, Agenda et la Revue (« tâches terminées » y figure déjà dans le GLOSSARY, entrée « Revue »). Effet : un seul mot pour une tâche cochée. Effort S. Risque : bas, mais ne pas remettre en cause l'archivage lui-même (`reports/2026-08-31-taches-archivage-menu-deroulant.md`). Fichiers : `TasksList.tsx`, `agenda/ArchivedTasksSection.tsx`, `GLOSSARY.md`. Dépend de : P4 (même passe de charte).

**P6. Harmoniser les écrans de gestion avec les écrans de tâches.** (a) Utiliser `textButton` pour tous les « Annuler » (listes, tags, bascules d'ajout) ; (b) « Enregistrement… » avec le caractère ellipse partout ; (c) remplacer la croix rouge des sous-tâches par une icône de corbeille avec libellé accessible inchangé, ou ranger monter/descendre/supprimer derrière un seul bouton « … » par sous-tâche. Effet : mêmes gestes et mêmes styles dans le module. Effort S (a, b) / M (c). Risque : bas. Fichiers : `listes/ListesManager.tsx`, `listes/TagsManager.tsx`, `listes/AddListeToggle.tsx`, `listes/AddTagToggle.tsx`, `AddTaskForm.tsx`, `AddListeForm.tsx`, `AddTagForm.tsx`, `TasksList.tsx`. Dépend de : rien.

**P7. Décider du sort des tags.** Deux options : (1) filtre par tag dans la feuille « Filtres et tri » (une rangée de chips, même grammaire que la priorité) ; (2) si les tags restent inutilisés en base, retirer la gestion de tags de `/taches/listes` et le champ du formulaire (lourd, à valider). Recommandation : (1) si l'usage réel est confirmé, sinon ne rien faire. Effet : les tags servent à quelque chose. Effort M (1) / L (2). Risque : (2) touche données et recherche, et contredit le choix de 2026-08-30 (module avec tags) : le signaler à Vincent. Fichiers : `TachesView.tsx`, `lib/taches/compute.ts`. Dépend de : vérification de l'usage réel en base (non faite ici).

**P8. Rendre la poignée de réordonnancement explicable.** Quand la poignée est absente (vue filtrée, tri non manuel), afficher une ligne d'aide discrète (« Ordre manuel : passe en vue Tout, tri manuel, sans filtre ») ou la griser au lieu de la masquer, et ne jamais mélanger deux patrons dans le module sans que l'écran le dise. Effet : l'utilisateur comprend pourquoi il ne peut pas déplacer. Effort S. Risque : bas. Fichiers : `TachesView.tsx`, `TasksList.tsx`. Dépend de : rien.

**P9. Unifier la règle « (optionnel) ».** Soit tous les champs facultatifs, soit aucun (les champs sont tous facultatifs sauf le titre ; préférer « aucun » et marquer seulement « Titre » obligatoire). Effort S. Risque : bas. Fichiers : `AddTaskForm.tsx`, `listes/CouleurPicker.tsx`. Dépend de : rien.

Ordre suggéré : P4 et P5 (charte), P1, P6, P3 (avec accord), P2, P8, P9, P7 en dernier.

## Pistes inter-modules (non détaillées)
- Puces de report partagées entre Tâches (barre de sélection), Aujourd'hui (carte « En retard ») et Revue.
- « Archivées / terminées » et tâches du jour/à supprimer : même vocabulaire à aligner avec Agenda.
- Vue « À faire » de Tâches et section « Tâches » d'Aujourd'hui : doublon partiel à arbitrer (qui est l'écran de référence ?).
- Saisie en langage naturel (accueil) et FAB de Tâches : deux entrées de création de tâche.
- Tags de tâches et recherche globale.

## Ce qui n'a pas pu être testé
- Base réelle, notifications/rappels, glisser-déposer tactile, appui long en vrai tactile, clavier virtuel : non testés (banc Chromium headless).
- Usage réel des tags, des tâches du jour et du nombre de tâches : chiffres du 18/09 repris du rapport existant, non revérifiés (base réelle interdite).
- Faux Supabase : partagé avec d'autres agents ; les données ont changé entre captures (autres tâches présentes, « Tâche e2e du jour » cochée par un autre agent). J'y ai ajouté une tâche « Appeler le dentiste », une liste « Maison » et un tag « urgent ». Étapes des parcours en échec (clics sur « Supprimer » dans `r-selection-suppr`, certains clics de `r-carte`) : cible disparue à cause de l'état partagé, pas un bug de l'app. Artefacts sans importance : 404 sur `/_vercel/speed-insights/script.js`, requêtes `_rsc` annulées lors de navigations.
- Script Playwright de l'audit : il plantait (Chromium 1194 absent, 1243 présent) ; j'ai utilisé une copie corrigée dans le scratchpad, sans toucher au dépôt. Le skill n'est pas corrigé.
- Suppression d'une liste, sélection groupée et feuille « Filtres et tri » : lues dans le code, non parcourues de bout en bout (captures `r-carte/16` non examinée).
- Écrans sombres : captures générées (`taches.sombre.png`, `taches_listes.sombre.png`), non examinées ; hors axes A/B/C.
