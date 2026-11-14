# Cohérence interne — module Réglages (lecture seule, 2026-11-14)

Sources : code `src/app/(app)/reglages/*`, `src/components/Switch.tsx`, `src/lib/theme.ts`, `actions/{briefing,nettoyage,preferences-navigation}.ts`, `supabase/functions/*`, GLOSSARY / PRODUCT / DESIGN, rapports `2026-09-15-reglages-polish`, `2026-09-25-audit-navigation`, `2026-10-27-lot-4-coherence-navigation`. Captures et scénarios : `reports/audit/reglages/` (`ecrans/`, `scenarios/bascules.json`, `parcours/bascules/`, `parcours/custom/` clair et sombre, défilement complet).

## Résumé
- Un seul écran, bien rangé en cartes (Préférences, Rappels, Données, Astuces, À propos), vocabulaire des rappels conforme au GLOSSARY ; interrupteurs accessibles (zone de tap 44 px).
- Cohésion fonctionnelle fragile : Réglages ne montre que 4 des 6 sources de notification, les réglages utiles vivent ailleurs (objectifs kcal dans Nutrition, rappel par tâche, verrou du Journal, jours libres), et la navigation se règle dans un autre écran (Plus) qui renvoie ici.
- Les 5 rappels sont grisés et inutilisables tant que les notifications push ne sont pas actives sur cet appareil, alors que les réglages sont stockés côté serveur ; le « jour de revue » pilote aussi la carte Revue d'Aujourd'hui mais n'est visible que rappel activé.
- Petits écarts : Apparence en bouton qui affiche l'état courant (ambigu, et contraire à la règle « 2 à 4 options = contrôle segmenté »), trois formulations pour « terminé », trois pour l'heure, Astuces et « À propos » presque vides de sens.
- 8 propositions (P1 à P8), surtout S ; aucune ne remet en cause un choix documenté (le thème dans Réglages est documenté dans PRODUCT.md:23).

## Inventaire des écrans
| Route | Rôle |
|---|---|
| `/reglages` (`page.tsx`) | Retour « Plus », titre, 5 sections : **Préférences** (Personnaliser la navigation → `/plus`, Apparence), **Rappels** (Notifications + Briefing du matin, Rappel de la revue hebdomadaire, Alerte limite kcal, Rappel de saisie des repas, Rappel du soir pour le Journal), **Données** (Nettoyage automatique), **Astuces** (4 puces), **À propos** (Profil : Vincent). |
| `loading.tsx` | Squelette. |
| Entrée | Uniquement la tuile Plus › Réglages (2 taps) ; aucune porte depuis Aujourd'hui (le bouton thème fixe a été retiré, PRODUCT.md:23). |
Pas de sous-route. Captures : `ecrans/reglages.clair.png`, `reglages.sombre.png` ; défilement complet `parcours/custom/clair-01…03.png`, `sombre-01…03.png` ; thème `parcours/bascules/04-reload.png`, `05-click.png`.

Où vivent les autres réglages (hors de cet écran) :
| Réglage | Lieu |
|---|---|
| Ordre de la grille, épinglage en barre du bas | Plus (appui long) ; Réglages ne fait que renvoyer vers Plus |
| Cibles kcal et macros (jour repos / entraînement) | Nutrition › Carnet (`nutrition/journal/ObjectifForm.tsx`) |
| Jours libres (2 jetons par semaine) | carte « Jour libre » d'Aujourd'hui (`JourLibreCard.tsx`) |
| Rappel d'une tâche | formulaire de tâche (`AddTaskForm.tsx`, push `envoyer-rappels-taches`) |
| Rappel de repos entre séries | automatique dans la séance (`synchroniserRappelRepos`, push `envoyer-rappel-repos`), sans réglage |
| Verrou du Journal | écran de verrouillage du Journal (`journal/VerrouGate.tsx`) |
| Horaires de travail | lus par Agenda (`getPlanningTravail`), pas d'écran de saisie dans l'app |
| Thème | Réglages (stocké sur l'appareil : cookie et localStorage, pas en base) |

## Constats

### Axe A — parcours et hiérarchie
- A1 (moyenne) Les cinq rappels sont grisés et désactivés (`fieldset disabled`, `NotificationsContext.tsx:40-45`) tant que l'interrupteur « Notifications » est éteint, avec un bandeau « Active d'abord les notifications… ». Or ces réglages sont partagés en base (une ligne `reglages_briefing`) : sur un navigateur sans push (bureau, permission refusée, VAPID absente comme au banc) on ne peut pas les régler, même pour un autre appareil. Vu : capture `parcours/bascules/05-click.png` (erreur d'activation, tout reste gris). Choix de conception cohérent, mais couplé à l'appareil et non au compte.
- A2 (moyenne) « Personnaliser la navigation » (`page.tsx:70-90`) mène à `/plus`, qui est la grille normale avec l'indice « Appui long… » : on ne « personnalise » rien en arrivant, et rien ne dit qu'il faut un geste. Le haut de la page propose en plus « Retour vers Plus » (`page.tsx:62`) : deux liens vers le même écran avec deux promesses différentes.
- A3 (basse) Astuces : quatre puces génériques, dont deux appartiennent à d'autres écrans (« Ajoute… » à Aujourd'hui, « Jour d'entraînement » à la carte Séances) et une duplique l'indice de Plus (`page.tsx:114-128`). Écran peu visité : l'astuce ne sera lue ni au bon endroit ni au bon moment. La première puce est inexacte : sur `/agenda`, `/nutrition`, `/journal` le balayage n'est actif que dans la bande du haut (`TabSwipeWrapper.tsx:21`).
- A4 (basse) « À propos » ne contient qu'une ligne non interactive, « Profil · Vincent » (`page.tsx:132-150`) ; la ligne « Version » du polish 09-15 a disparu. Une section de titre pour une valeur sans effet, à la fin d'un écran de 1750 px de haut.
- A5 (basse) Nettoyage automatique : l'activation demande confirmation (`ConfirmDialog`, constat T2), mais abaisser le délai à 1 jour n'en demande aucune (`NettoyageAutoRow.tsx:78-85`, `validerDelai`) alors que l'effet est le même (suppression définitive).
- Vu conforme : titre et cartes lisibles, détail aligné sous le titre (`ReglageDetail`), zones de tap des interrupteurs à 44 px (`Switch.tsx`, 44 × 26 + pseudo-élément), erreurs d'enregistrement revenant à l'état précédent (`runAction`, tests `*Row.test.tsx`), persistance du thème au rechargement (`parcours/bascules/04-reload.png`).

### Axe B — vocabulaire et gestes
- B1 (moyenne) Apparence est un bouton qui affiche l'état courant (« Clair » ou « Sombre », `AppearanceRow.tsx:34-37`, capture `05-click.png`) : on ne sait pas si l'étiquette décrit le thème actuel ou celui qu'on va choisir. DESIGN.md:252 et le rapport lot 4 fixent « tout choix à 2-4 options passe par `SegmentedControl` ». De plus, après un premier choix il n'y a plus de retour au réglage système (`theme.ts`, cookie prioritaire sur `prefers-color-scheme`).
- B2 (basse) Le mot « terminé » a quatre formes sur la même ligne : titre « Supprimer les items faits après (jours) » (`NettoyageAutoRow.tsx:117`), détail « terminé depuis plus de N jours : tâches, sous-tâches, courses et items de notes », boîte de confirmation « articles de courses pris », « items de notes cochés ». GLOSSARY : « à prendre / pris » pour Courses ; « items » n'y figure pas.
- B3 (basse) Le champ d'heure s'appelle « Heure d'envoi » (Briefing), « Jour et heure » (Revue, avec `aria-label` « Heure du rappel de revue »), « Heure du rappel » (Rappel de saisie, Journal). Même geste, trois libellés ; « Briefing du matin » est le seul rappel sans le mot Rappel/Alerte (non listé au GLOSSARY).
- B4 (basse) Descriptions des lignes d'état éteint codent des chemins de navigation en dur : « la revue reste accessible depuis Plus » (`RevueHebdoRow.tsx:80`), « Plus › Journal » (`VidageRow.tsx:79`). Elles deviendront fausses dès qu'un module change de place.
- B5 (basse) Description de la tuile Réglages dans le registre : « Profil, apparence et préférences » (`registry.ts:271`) ; l'écran porte surtout des rappels et un nettoyage, le profil est une ligne statique.
- B6 (basse) Gestes d'enregistrement : les interrupteurs et listes s'appliquent tout de suite, les champs d'heure à la perte du focus (`onBlur`), sans accusé de réception visible hors erreur. Cohérent entre les lignes ; seul le toast « Enregistré » manque (GLOSSARY ne décrit pas de patron pour l'enregistrement automatique).
- Vu conforme : « Rappel de la revue hebdomadaire », « Rappel de saisie des repas », « Rappel du soir pour le Journal », « Carnet alimentaire », « Supprimer » (jamais « Effacer ») sont ceux du GLOSSARY.

### Axe C — cohésion fonctionnelle
- C1 (moyenne) La liste des notifications est incomplète : Réglages règle 4 des 6 fonctions push (`supabase/functions/envoyer-*`) ; les rappels de tâche et de repos de séance n'ont ni ligne ni mention, mais tombent aussi sous l'interrupteur « Notifications » et se taisent s'il est éteint. Le bandeau « les rappels ci-dessous » laisse penser que la liste est exhaustive.
- C2 (moyenne) Le jour de la Revue est un réglage à double usage caché : `revue_jour` choisit le jour du rappel et aussi le jour où la carte Revue sort du pli sur Aujourd'hui (`actions/briefing.ts:23`, `AujourdhuiView.tsx:168`). Le sélecteur de jour n'apparaît que si le rappel est actif (`RevueHebdoRow.tsx:78-100`) et la ligne entière est grisée sans push : on ne peut pas régler ce jour sans activer un rappel.
- C3 (moyenne) Réglages éclatés : la limite kcal utilisée par « Alerte limite kcal » se règle dans Nutrition (`ObjectifForm`) sans lien depuis Réglages ; la navigation se règle dans Plus ; le verrou du Journal dans le Journal ; les horaires de travail n'ont pas d'écran (voir tableau). Chaque cas est défendable seul, mais Réglages n'oriente vers aucun.
- C4 (basse) Découpage : « Données » ne porte qu'un réglage (Nettoyage) et « Préférences » deux (navigation, apparence) ; « Rappels » en porte six, dont la ligne « Notifications » qui n'est pas un rappel mais l'autorisation de tous.
- C5 (basse) Fixture de test orpheline : `reglages_saisie_ia` (`e2e/mock-supabase.mjs:67`) n'est lue nulle part dans `src/` ; aucun réglage de « liste par défaut de la saisie naturelle » n'existe dans l'app.
- C6 (basse) Réglages n'est atteint que par Plus (2 taps) ; pas de porte depuis Aujourd'hui depuis le retrait du bouton thème (choix documenté, PRODUCT.md:23). Pas un défaut, mais le thème est le réglage le plus rapide à vouloir changer (lumière du jour).

## Propositions

**P1 — Un seul endroit pour régler la barre du bas**
- Changement : section « Barre du bas » dans Réglages avec 4 sélecteurs (Emplacement 1 à 4, liste des modules) et un bouton « Rétablir l'ordre d'origine » ; « Personnaliser la navigation » devient cette section, et l'appui long de Plus reste un raccourci.
- Effet : supprime le lien circulaire Plus ⇄ Réglages, rend l'épinglage accessible sans geste (voir `plus.md` P1 et P8) et donne une réinitialisation.
- Effort M. Risque : moyen (deux interfaces pour la même donnée à garder synchrones : même `NavigationEditContext`). Fichiers : `reglages/page.tsx`, nouvelle ligne `NavigationRow`, `NavigationEditContext.tsx`, `actions/preferences-navigation.ts`. Dépendances : `plus.md` P1, P7, P8.

**P2 — Laisser régler les rappels sans push sur cet appareil**
- Changement : retirer `disabled` du `fieldset` ; garder grisé léger et bandeau d'avertissement, mais permettre de régler heure et jour.
- Effet : réglages utilisables depuis n'importe quel navigateur (les rappels partent de toute façon vers l'appareil abonné).
- Effort S. Risque : faible ; contredit la décision du bandeau (`NotificationsContext.tsx`), à valider ; mettre à jour `*Row.test.tsx` (désactivation attendue). Fichiers : `NotificationsContext.tsx`, tests. Dépendances : aucune.

**P3 — Apparence en contrôle segmenté « Clair · Sombre · Auto »**
- Changement : `SegmentedControl` à trois options (Auto supprime cookie et localStorage et reprend le système).
- Effet : l'état courant est visible, le geste sans ambiguïté, retour au système possible ; conforme à DESIGN.md:252.
- Effort S. Risque : faible (meta `theme-color`, cookie lu avant le premier rendu). Fichiers : `AppearanceRow.tsx`, `lib/theme.ts`. Dépendances : aucune.

**P4 — Sortir « Jour de la revue » de la ligne du rappel**
- Changement : sélecteur « Jour de la revue » toujours visible dans la ligne Revue (indépendant du rappel), avec le texte « Ce jour-là, la revue passe en tête d'Aujourd'hui ».
- Effet : le double usage devient explicite et le jour est réglable rappel éteint.
- Effort S. Risque : faible (action `updateReglagesRevue` déjà là). Fichiers : `RevueHebdoRow.tsx`, `actions/briefing.ts` éventuellement. Dépendances : P2 pour le grisé.

**P5 — Harmoniser les libellés**
- Changement : « Heure du rappel » partout (Briefing : « Heure d'envoi » devient « Heure du rappel »), « Jour et heure » devient « Jour du rappel » + « Heure du rappel » ; nettoyage : « Supprimer ce qui est terminé depuis (jours) » et mêmes mots dans le détail et la confirmation (« terminé » pour tâches, notes ; « pris » pour Courses) ; description de tuile « Rappels, apparence et navigation » ; remplacer les chemins en dur (« depuis Plus ») par « le Journal reste accessible ».
- Effet : un geste, un mot ; copie qui survit aux déplacements de modules.
- Effort S. Risque : faible (tests texte). Fichiers : `BriefingRow.tsx`, `RevueHebdoRow.tsx`, `AlertesNutritionRow.tsx`, `VidageRow.tsx`, `NettoyageAutoRow.tsx`, `registry.ts`. Dépendances : aucune.

**P6 — Alléger Astuces et À propos**
- Changement : garder 0 ou 1 astuce utile dans Réglages (corriger « Balayer… » : « dans la bande du haut sur Agenda, Nutrition et Journal »), déplacer les autres sur leur écran, supprimer ou donner un sens à « À propos » (par exemple version de l'app et lien vers `/plus`).
- Effet : un écran plus court (1750 px), sans texte hors de propos.
- Effort S. Risque : faible. Fichiers : `reglages/page.tsx`, `AujourdhuiView.tsx` pour une astuce déplacée. Dépendances : aucune.

**P7 — Dire toutes les notifications et relier les réglages voisins**
- Changement : sous « Rappels », une ligne d'information « Aussi : rappels de tâche (dans chaque tâche) et repos de séance (automatique) », et, sous « Alerte limite kcal », lien « Régler la limite dans le Carnet ».
- Effet : la liste ne ment plus par omission ; Réglages oriente vers les réglages dispersés.
- Effort S. Risque : faible. Fichiers : `reglages/page.tsx`, `AlertesNutritionRow.tsx`. Dépendances : aucune.

**P8 — Protéger le raccourcissement du délai de nettoyage**
- Changement : réutiliser `ConfirmDialog` quand le délai baisse sous 7 jours (ou affiche « N éléments concernés ») ; renommer la section « Données » en « Nettoyage ».
- Effet : même garde-fou qu'à l'activation, section nommée par ce qu'elle contient.
- Effort S. Risque : faible. Fichiers : `NettoyageAutoRow.tsx`, `reglages/page.tsx`. Dépendances : aucune.

## Pistes inter-modules
- Plus : P1 de ce rapport et P1/P7/P8 de `plus.md` forment un seul chantier (barre du bas : un lieu, un réglage, une réinitialisation).
- Nutrition : l'alerte à 85 % et le rappel de saisie dépendent des cibles du Carnet ; lien Réglages › Carnet (P7) et mention des cibles dans le texte de l'alerte.
- Aujourd'hui : le jour de revue pilote une carte de l'écran du jour (P4) ; coordonner avec sa refonte.
- Tâches et Musculation : leurs rappels sont des notifications sans réglage global (C1) ; décider si un interrupteur « Rappels de tâche » et « Repos de séance » a sa place ici.
- Journal : verrou et rappel du soir sont à deux endroits ; à examiner avec la refonte du Journal.

## Ce qui n'a pas pu être testé
- Notifications push, abonnement, permission navigateur : au banc l'activation échoue (« Clé VAPID publique manquante », capture `05-click.png`) ; je n'ai donc pas pu activer les rappels depuis l'interface. J'ai seulement levé le `disabled` des `fieldset` dans le DOM (aucune écriture) pour lire l'état des interrupteurs (tous éteints, nettoyage actif, 30 jours) et mesurer les cibles tactiles.
- Envoi réel des rappels (Edge Functions `envoyer-*`, `nettoyage-auto`), passkeys et verrou du Journal, appareil physique : impossibles ici.
- Écriture des réglages (briefing, revue, alerte, saisie, Journal, nettoyage) : volontairement non jouée pour ne pas modifier la ligne `reglages_briefing` du faux Supabase partagé ; le comportement d'échec et de reprise est couvert par les tests unitaires existants, que je n'ai pas relancés.
- Champ d'heure sur Android réel (enregistrement à la perte du focus, `onBlur`) : à vérifier sur téléphone, notamment en quittant l'écran sans toucher ailleurs.
- Effet du jour de revue sur Aujourd'hui (C2) lu dans le code (`AujourdhuiView.tsx:168`), non rejoué (date du banc, réglage `revue_actif` éteint).
- Éléments du banc : `/_vercel/speed-insights/script.js` en 404 et `_rsc` annulés sont des artefacts. Ressenti d'usage : jugement.

## Résumé final
- Réglages est un écran net et conforme au GLOSSARY pour les rappels, mais il ne dit pas toute la vérité : 4 notifications sur 6, des réglages voisins ailleurs, et la navigation renvoyée vers Plus.
- Les rappels ne sont modifiables que si le push est actif sur l'appareil, et le jour de revue (qui pilote aussi Aujourd'hui) est caché derrière le rappel.
- À corriger en priorité : barre du bas réglable ici (P1), rappels éditables sans push (P2), Apparence en contrôle segmenté (P3), jour de revue visible (P4).
- Finitions : un mot par geste (P5), Astuces et À propos allégés (P6), notifications et réglages voisins signalés (P7), garde-fou du délai de nettoyage (P8).
- Rapports : `/home/user/Kilio/reports/refonte-modules/plus.md` et `/home/user/Kilio/reports/refonte-modules/reglages.md`.
