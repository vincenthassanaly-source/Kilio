# Audit design : module Musculation (2026-11-12)

Lecture seule. Périmètre : `src/app/(app)/musculation/**` (accueil, séance, historique, routines, stats), `SeanceFlottante`, `lib/musculation` (lecture), `lib/ui.ts`, `IndicateurConnexion`, `ConfirmDialog`, `BarreRepos`. `VideoFeed` n'est pas utilisé par Musculation (seulement `collection/[id]/PhotosGrid.tsx`) : hors périmètre. Grille : 3 passes du brief (conformité/a11y, parcours, finitions). Aucun rendu navigateur : les constats visuels sont marqués « à confirmer ».

## Résumé

- Base solide : champs étiquetés par série, `aria-pressed` sur le ✓, zones 44-48 px sur le geste principal, confirmations explicites, brouillon Dexie écrit à chaque saisie. Aucun constat critique.
- Les points faibles touchent le geste le plus fréquent (la séance en salle) : minuteur qui couvre la saisie, fin de séance sans retour d'attente, séances en attente d'envoi invisibles, bouton « Démarrer » qui apparaît avec retard.
- 0 Critique, 7 Important, 14 Mineur (M14 regroupe 5 finitions), 6 options structurantes. Les doublons avec l'audit du 2026-11-07 sont cités en fin de rapport, pas refaits.

## Critique

Aucun.

## Important

### I1. `BarreRepos` reste affichée quand le clavier est ouvert et couvre le champ saisi
- Fichiers : `seance/BarreRepos.tsx:30` (conteneur `fixed bottom-0`, pas de `data-masquer-saisie`) ; `src/app/layout.tsx:40` (`interactiveWidget: "resizes-content"`) ; `globals.css:315` ; `SeanceFlottante.tsx:26-48` (réimplémente le masquage à la main).
- Scénario (parcours) : ✓ sur la série 1, le repos démarre, `BarreRepos` apparaît (~110 px). L'utilisateur touche le champ « kg » de la série 2 : le clavier réduit la fenêtre, la barre `fixed` remonte au-dessus du clavier et recouvre la zone de saisie sur un petit écran. `SeanceFlottante` évite exactement ce cas ; l'écran de séance, où il se produit le plus souvent, non.
- Axe : Memorable detail (le geste ✓ puis saisie suivante), Constraints (mécanisme `MasquageSaisie` existant).
- Correctif : ajouter `data-masquer-saisie` au conteneur de `BarreRepos` (et remplacer le hook local de `SeanceFlottante` par le même attribut).
- Correctif sûr : oui. Le minuteur est masqué pendant la saisie et revient à la fermeture du clavier, comme pour la barre flottante.

### I2. La carte « Démarrer / Reprendre » n'existe pas pendant la lecture Dexie : le contenu saute
- Fichier : `DemarrerSeance.tsx:21` (`if (brouillon === undefined) return null`). `loading.tsx` réserve un `h-28`, mais le client rend `null` puis la carte (~130-150 px).
- Scénario : ouverture de Musculation, l'utilisateur vise « Démarrer » d'une routine ; la carte apparaît au-dessus après la lecture locale et pousse la liste de ~140 px sous son doigt. Un tap peut tomber sur la mauvaise routine, ou sur « Statistiques ».
- Axe : Memorable detail (lancement de séance), Purpose (quelques secondes, une main).
- Correctif : rendre un `Skeleton` de même hauteur que la carte tant que `brouillon === undefined`.
- Correctif sûr : oui.

### I3. « Terminer » : aucun retour pendant l'envoi, aucun délai maximal
- Fichiers : `seance/SeanceView.tsx:143-181` (`finir` : `await synchroniserSeances()`), `:226` et `:298` (seul effet visible : `disabled` + `opacity-60`, libellé inchangé) ; `lib/musculation/brouillon.ts:80-120` (appel serveur sans timeout) ; « Quitter » (`:223`) reste actif.
- Scénario (parcours) : fin de séance avec un signal faible. Tap « Terminer » : la séance est déjà en sécurité localement (`terminerSeance`), mais l'écran ne dit rien pendant que la requête traîne ; l'utilisateur retape, ou appuie sur « Quitter ».
- Axe : Memorable detail (retour visuel, hors ligne).
- Correctif : libellé « Enregistrement… » (+ `aria-busy`) ; désactiver aussi « Quitter » pendant `envoi` ; borner l'attente de `synchroniserSeances` (≈ 4 s) puis partir sur le chemin « séance gardée sur ton téléphone » existant.
- Correctif sûr : oui pour le libellé et « Quitter » ; non pour le délai (change le moment où le récapitulatif s'ouvre).

### I4. Une séance terminée mais pas encore envoyée n'est visible nulle part
- Fichiers : `components/IndicateurConnexion.tsx:15,52` (ne compte que `compterFileAttente`, pas `musculation_a_envoyer`) ; `lib/musculation/MusculationSync.tsx:41-43` (toast d'erreur répété à chaque retour au premier plan tant que la séance est refusée) ; `seance/SeanceView.tsx:163,178` (toast unique de 4,5 s) ; `DernieresSeances.tsx` et `historique/HistoriqueView.tsx` (liste serveur uniquement).
- Scénario (parcours) : séance terminée en sous-sol de salle, hors ligne. Toast de 4,5 s. Le soir, l'utilisateur ouvre l'historique : la séance n'y est pas, rien n'explique pourquoi, aucun indicateur « 1 en attente ». Si le serveur la refuse (exercice retiré du catalogue), elle reste bloquée et le même toast d'erreur revient à chaque réouverture, sans action possible.
- Axe : Constraints (hors ligne, file Dexie visible), Purpose (consulter en quelques secondes).
- Correctif : lire `musculation_a_envoyer` (comme `useBrouillonEnCours`) et afficher en tête de « Dernières séances » / Historique une ligne « 1 séance en attente d'envoi » (avec le message d'erreur si refus et un bouton « Réessayer ») ; compter ces séances dans `IndicateurConnexion`.
- Correctif sûr : non (nouvelle lecture Dexie et nouvelle ligne d'interface ; réutilise `LigneEntrainement` et `IndicateurConnexion`, pas de nouveau composant).

### I5. Pastilles de type (échauffement, dropset…) sans zone de tap étendue
- Fichiers : `seance/ExerciceBloc.tsx:360`, `seance/SeanceView.tsx:244` (type de séance Push/Pull/Legs), `routines/[id]/RoutineEditeur.tsx:138` et `:279`. Les pastilles du sélecteur (`SelecteurExercices.tsx:26`) et de la fiche (`FicheExercice.tsx:106`) utilisent `zoneTapPill` ; pas celles-ci. Hauteur visible ≈ 30 px.
- Scénario : en salle, doigts moites, choisir « Dropset » ou « Échec » dans la ligne qui s'ouvre sous la série : cible ~30 px, rangées de pastilles à 8 px d'écart. Les 24 px de WCAG 2.5.8 sont tenus, pas les 44 px de DESIGN.md.
- Axe : Constraints (cible 44 px, DESIGN « Buttons »), Memorable detail.
- Correctif : ajouter `zoneTapPill` à ces quatre classes (et passer `gap-2` à `gap-x-2 gap-y-4` si les rangées se touchent : DESIGN demande ≥ 16 px entre rangées).
- Correctif sûr : oui.

### I6. La barre `SeanceFlottante` masque la fin de chaque page
- Fichiers : `SeanceFlottante.tsx:127-128` (`bottom: 88px`, barre ≈ 64 px) ; `components/TabSwipeWrapper.tsx:101` (`paddingBottom: safe-area + 112px`, calibré pour la seule barre du bas).
- Scénario : séance en cours, ouverture de Musculation, défilement jusqu'au bout : le bas de la carte « Statistiques » (~40 px) reste sous la barre, impossible à faire remonter. Même chose sur tout formulaire dont le bouton de validation est en bas de page (à confirmer visuellement).
- Axe : Purpose (une main, quelques secondes), Constraints (focus non masqué, WCAG 2.4.11).
- Correctif : poser une variable CSS (ex. `--seance-flottante-h`) quand la barre est affichée et l'ajouter au `paddingBottom` de `<main>` ; ou +72 px de padding quand `brouillon` existe.
- Correctif sûr : oui (espacement seul), à valider sur appareil. La collision avec le FAB est un autre sujet, déjà cité (I-12).

### I7. Routine ouverte hors ligne : « Cette routine n'existe plus. »
- Fichier : `routines/[id]/RoutineEditeur.tsx:366-381` (seul `isLoading` est lu ; `isError` retombe sur `!data`). Pas de `BackLink` dans cet état.
- Scénario : la liste des routines vient du cache, l'utilisateur ouvre « Push A » sans réseau : message faux, qui incite à la recréer. Les autres écrans du module distinguent chargement, erreur et absence (`ErrorInline`).
- Axe : Constraints (hors ligne, `ErrorState`/`ErrorInline`), Audience (usage parfois hors ligne).
- Correctif : lire `isError` / `refetch`, afficher `ErrorInline` « Impossible de charger la routine. Vérifie ta connexion. » avec `retry`, et réserver « n'existe plus » à `data === null` avec un `BackLink`.
- Correctif sûr : oui.

## Mineur

### M1. Double tap sur ✓ en séance : la série est validée puis annulée
- Fichier : `seance/ExerciceBloc.tsx:316-341` (bascule pure, aucune garde). Même famille que I-7 (barre flottante), mais ici le résultat est une série non comptée ; l'annulation n'est signalée que par la couleur.
- Scénario : double tap involontaire ; le minuteur démarre puis disparaît (`basculerSerie` coupe le repos lancé par cette série).
- Axe : Memorable detail. Correctif : ignorer un second tap sur la même série sous ~400 ms (ref d'horodatage). Sûr : oui.

### M2. « Terminer » de la barre flottante ouvre la séance au lieu de terminer
- Fichier : `SeanceFlottante.tsx:164-166` (`<Link href=URL_SEANCE>` libellé « Terminer »).
- Scénario : toutes les séries validées, tap « Terminer » : l'écran de séance s'ouvre, il faut retaper « Terminer ». Le libellé promet plus que l'action.
- Axe : Purpose. Correctif : libellé « Ouvrir » ou « Voir la séance » ; ou, plus ambitieux, voir Options. Sûr : oui (libellé).

### M3. « Démarrer » désactivé sans explication
- Fichier : `RoutinesSection.tsx:55-63` (`disabled={seanceEnCours || demarrage || routine.nbExercices === 0}`, seule trace : `opacity-60`).
- Scénario : séance en cours : toutes les routines ont un bouton grisé muet ; routine vide : idem.
- Axe : Purpose, Tone. Correctif : une ligne `metaText` « Termine ta séance en cours pour en lancer une autre » sous le titre de section, et « Aucun exercice » sur la routine vide. Sûr : oui. (Le garde-fou côté logique est cité en I-9.)

### M4. Dialogue « Terminer la séance ? » (séries non validées) : « Garder » ambigu
- Fichier : `seance/SeanceView.tsx:370-385`. Le bouton sûr est `Garder` (`ConfirmDialog.tsx:48`) ; seul le cas « marche » explique ce que « Garder » fait (`:364-367`).
- Axe : Tone, Audience. Correctif : ajouter « Choisis « Garder » pour reprendre la séance. » Sûr : oui.

### M5. Retrait d'un exercice sans annulation
- Fichiers : `seance/ExerciceBloc.tsx:226-234` (aucune confirmation si aucune série validée, donc les poids saisis partent) ; `routines/[id]/RoutineEditeur.tsx:206` (« Retirer » à 8 px de ↓, sans confirmation).
- Scénario : mauvais tap sur « Retirer l'exercice » (ligne à 48 px de « Retirer la dernière série ») ; le bloc et ses valeurs disparaissent.
- Axe : Memorable detail (annulation). Correctif : toast « Annuler » (patron `supprimerAvecAnnulation`) ou confirmation quand des valeurs sont saisies. Sûr : non (état à restaurer).

### M6. `role="menu"` sans comportement de menu
- Fichier : `seance/ExerciceBloc.tsx:154-236` (`role="menu"` contenant des boutons « −15 s / +15 s » qui ne sont pas des `menuitem`, pas de flèches clavier, pas de gestion du focus).
- Axe : Constraints (noms/rôles WCAG 4.1.2). Correctif : retirer `role="menu"`/`menuitem` et garder le motif disclosure déjà en place (`aria-expanded`). Sûr : oui.

### M7. Colonne « Précédent » inutile en modification d'une séance passée
- Fichiers : `seance/ExerciceBloc.tsx:115,257,298` ; `historique/EditionEntrainement.tsx:125-141` (`brouillonDepuisEntrainement` fixe `precedent: []`, `historique.ts:94`). La colonne n'affiche que des « – » et prend la largeur du `1fr`.
- Axe : Tone (dense, utile). Correctif : masquer l'en-tête et la cellule quand `edition`. Sûr : oui.

### M8. Graphique : l'infobulle disparaît quand on lève le doigt
- Fichier : `stats/GraphiqueProgression.tsx:132-134` (`onPointerLeave={() => setActif(null)}`). Sur écran tactile, `pointerleave` suit `pointerup` : la valeur ne se lit que doigt posé, donc doigt sur le point. Les dernières valeurs sont étiquetées et le tableau existe (bon point), mais la lecture directe d'un point précis échoue.
- Axe : Audience (téléphone). Correctif : ne remettre `actif` à `null` que pour `e.pointerType === "mouse"`. Sûr : oui (à confirmer sur appareil).

### M9. Texte du graphique sous le plancher de 11 px sur téléphone
- Fichier : `stats/GraphiqueProgression.tsx:11,75,80,84` (`viewBox` de 360 unités, `fontSize={11}`). Dans une carte de ~294 px, l'échelle est ~0,82 : graduations et dates à ~9 px.
- Axe : Constraints (plancher 11 px, DESIGN « Typography »). Correctif : réduire le `viewBox` (L ≈ 300) ou monter `fontSize` à 13. Sûr : oui (à confirmer visuellement).

### M10. Pastille de type de séance en variante « kcal »
- Fichier : `historique/HistoriqueView.tsx:24` (`kcalPillTag` pour PUSH/PULL/LEGS). DESIGN.md « Chips / Pills » réserve cette variante aux tags portant une valeur calorique.
- Axe : Constraints. Correctif : `pillTag` (neutre). Sûr : oui.

### M11. `--accent-musculation` : hors usage documenté, voisin de l'alerte
- Fichiers : `globals.css:57` (`oklch(0.55 0.14 20)`) ; `stats/GraphiqueProgression.tsx:14`, `stats/StatsView.tsx:93` (courbe et barres). DESIGN.md « Module Accents » ne cite pas Musculation et limite ces teintes à l'icône du module ; teinte 20 proche de `--accent-alert` (25) : barres brique, lecture « alerte » possible.
- Axe : Constraints, Tone. Correctif : documenter la teinte et son usage dans DESIGN.md (sûr : oui) ; la remplacer par `--accent-kcal` pour les données (sûr : non, choix de design).

### M12. « Voir plus » (historique) sans retour pendant le chargement
- Fichier : `historique/HistoriqueView.tsx:74-78` (`keepPreviousData` : la liste ne change pas tant que la page 2 n'est pas arrivée).
- Axe : Memorable detail (retour visuel). Correctif : utiliser `isPlaceholderData` pour afficher « Chargement… » et `disabled`. Sûr : oui.

### M13. Formulaires longs sans garde de sortie
- Fichiers : `historique/EditionEntrainement.tsx:88` (séance passée), `routines/[id]/RoutineEditeur.tsx:144`. Le `BackLink` ou le retour système abandonne une saisie de plusieurs exercices sans avertir.
- Axe : Purpose, Constraints. Correctif : confirmation « Abandonner les modifications ? » si le formulaire est modifié. Sûr : non (nouveau comportement de navigation ; voir aussi M-13 de l'audit global sur `useBackClose`).

### M14. Finitions (à regrouper en un seul lot)
- `SeanceFlottante.tsx:125` : `ease: "easeOut"` générique ; DESIGN.md « Tokens de finition » demande `var(--ease-out)`. Sûr : oui (courbe `[0.23, 1, 0.32, 1]` ou la valeur du token).
- `stats/StatsView.tsx:92` : barres en `rounded-r-[4px]`, coins gauches vifs, contraire à « aucun coin vif ». Correctif : `rounded-full`. Sûr : oui.
- `historique/[id]/EntrainementDetailView.tsx:157-172` : pile d'actions de hauteurs différentes (`h-12` = 48 px pour deux boutons, `secondaryButton` sans hauteur = ~46 px pour deux autres, `dangerButton` compact en dessous). Correctif : `h-12` uniforme sur les boutons pleins. Sûr : oui.
- `stats/[exerciceId]/FicheExercice.tsx:72-74` : `BackLink` collé au titre (`gap-1`) alors que tous les autres écrans du module ont `gap-4`. Sûr : oui.
- `seance/ExerciceBloc.tsx:282` : la surbrillance `bg-kcal-soft` n'a aucun padding horizontal (`py-1` seul) ; la coche pleine vient toucher le bord de la pastille (à confirmer visuellement). Correctif : `px-1` en compensant la grille. Sûr : oui.

## Options structurantes

Non appliquées, à valider.

1. Doublon sur la page Musculation : `SeanceFlottante` (barre) et la carte « Séance en cours / Reprendre » (`DemarrerSeance.tsx:23-37`) affichent la même information ; la barre en plus masque le bas de page (I6). Option A : masquer la barre sur `/musculation` seulement ; option B : retirer la carte quand la barre est visible.
2. Accueil du module : « Séance libre » (grande carte primaire) est avant les routines, alors que le geste quotidien d'un expert est « relancer Push A ». Option : bouton « Démarrer » plein (primaire) sur la dernière routine utilisée, la séance libre devenant un lien secondaire. Les « Démarrer » de routine sont aujourd'hui en `ghostButton` (`RoutinesSection.tsx:55`).
3. Écran de séance : l'en-tête (chrono, progression, « Terminer ») défile avec les exercices. Option : barre compacte collée en haut (chrono, `faites/total`, « Terminer ») dès que l'en-tête sort de l'écran.
4. File d'envoi musculation unifiée à l'indicateur global (I4) : fusionner `musculation_a_envoyer` avec `compterFileAttente` pour un seul endroit de vérité.
5. Éditeur de routine : sections d'exercice repliables et réordonnancement par glisser (aujourd'hui 3 boutons `↑ ↓ Retirer` dans l'en-tête, qui laissent ~65 px au nom à 360 px de large, à confirmer).
6. Teinte propre de Musculation hors du rouge (M11) et documentation des teintes de module absentes de DESIGN.md (Pharmacie, Opinions, Vidage, Réglages sont dans le même cas).

## Déjà couvert par l'audit du 2026-11-07

Cités, non refaits :
- **I-7** double validation de série sur « Valider » de `SeanceFlottante` (`SeanceFlottante.tsx:100-114`). M1 ci-dessus ne concerne que le ✓ de l'écran de séance.
- **I-8** ajout/remplacement d'exercice sans retour ni garde (`SeanceView.tsx:306-323`) ; vaut aussi pour `EditionEntrainement.tsx:163`.
- **I-9** points d'entrée qui écrasent un brouillon (`demarrer.ts`, gardes UI seulement, `useBrouillonEnCours` à `undefined`).
- **I-12** collision FAB « + » / `SeanceFlottante` (conteneur pleine largeur sans `pointer-events: none`).
- **M-2** `finir()` / `abandonner()` : écriture du brouillon abandonnée après échec, rejet non géré.
- **M-13** modales sans `useBackClose` : `RoutinesSection` (`DossierModal`), `EntrainementDetailView`, `ConfirmDialog` (« Quitter la séance ? »).
- **M4 (perf)** `<video preload="auto" autoPlay>` par exercice (`AnimationExercice.tsx`) ; précache SW des animations (~6,6 Mo) ; **M3** miniatures.
- **Bilan a11y** : graphique avec `role="img"` et tableau alternatif ; tests manquants pour `lib/musculation/brouillon.ts` et `demarrer.ts`.

## Vérifié sans défaut retenu

Champs `ChampNombre` (nom accessible par série, 16 px, `inputMode`) ; ✓ de 48 px avec `aria-pressed` et libellé d'état ; `prefers-reduced-motion` pour les vidéos (`useReducedMotion`) ; graduations `tabular-nums` (`metaText`, chrono, minuteur) ; `ConfirmDialog` pour les actions destructives de l'historique ; `Skeleton` cohérents avec les `loading.tsx` ; toasts au-dessus de `BarreRepos` (`ToastHost.tsx:26-27`, z-60). Vérification de contraste des textes `text-kcal` sur `surface-alt` (≈ 5:1) : conforme.
