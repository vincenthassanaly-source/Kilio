# Critique impeccable — module agenda (mobile, 390 px)

Lecture seule : aucun code ni donnée du module modifié. Évaluations A (design) et B (détecteur + mesures) menées en sous-agents isolés.
Limites : captures du faux Supabase (1 tâche, 1 événement) ; Semaine/Mois peuplés, Liste vide, ouverture d'une tâche, clavier, lecteur d'écran non vus. Le ressenti d'usage reste un jugement.

## Preuves mécaniques (B)
- Détecteur impeccable : 0 finding. Aucun débordement horizontal de la page (4 vues, 2 thèmes).
- Contrastes tous ≥ 4,5:1 ; le plus juste : bloc événement clair 4,53:1 (texte 11-12 px).
- Cibles tactiles < 44 px : sélecteur de vue (87×35,5), case « Marquer fait » (22×22), titre de tâche (22,5 de haut), « + sous-tâches » (24,5), « Tâche sans heure » (36), puces « sans heure » de la Semaine (32).
- Barre du bas : masque 31 px de la grille Jour, 23 px de la Semaine ; le FAB recouvre la colonne de droite (Semaine, ~15-16h).
- 6 `<button>` de la rangée « sans heure » sans nom accessible : `aria-hidden` + `tabindex=-1`, donc sans effet réel.

## Problèmes prioritaires (A)
1. P1 Jour — l'auto-scroll cale la grille sur l'heure courante − 80 px et coupe le début de l'événement 09:00 (`TimeGrid.tsx`, `useInitialScroll`).
2. P1 Toasts — « Événement modifié » et « supprimé · Annuler » coexistent et masquent des heures ; à nuancer : le script enchaîne vite, mais il n'y a pas de remplacement du toast précédent (système de toasts partagé, `AgendaView.tsx`).
3. P2 Semaine — ~3,5 jours sur 7 par défaut, sans indice de défilement ni état vide (`WeekView.tsx`, `useAgendaZoom.ts`).
4. P2 Mois — légende « 12 férié » ambiguë, « jour travaillé » décrit un élément absent, « tâche(s) » (`MonthView.tsx`).
5. P2 Jour — tâches en puces grises sans coche, sans heure ; trois représentations de la même tâche (puce / carte / point) (`DayView.tsx` `PuceTache`, `TacheBlock.tsx`).
6. P2 Cibles tactiles < 44 px (voir B), dont le sélecteur de vue et la case à cocher.
7. P3 Formulaire événement : « Le titre est requis. » à ~300 px du champ ; select Durée natif ; raccourcis d'échéance du formulaire tâche cassés en 3 + 1.

## Cohérence entre écrans
- Navigation stable (segmenté + barre du bas) ; « Aujourd'hui » n'apparaît qu'après avoir quitté la période.
- Titres de période hétérogènes (acceptable), jour férié en pastille en Jour/Liste mais sans marque visible en Semaine/Mois sur les captures.
- Zone sûre mal gérée en Jour/Semaine (grille sous la nav), alors que Mois et Liste laissent du vide.
- États vides silencieux en Semaine et Mois.
- Clair/sombre : parité correcte, aucun défaut de contraste.

## À ne pas imputer à l'app
- Heure « 11:00 AM » : probable locale du navigateur de test.
- 404 `speed-insights` : script Vercel absent hors Vercel.

## Correctifs appliqués (après accord : « Tout corriger P1 à P3 + tests »)
- P1 scroll Jour/Semaine : `computeInitialScrollTop` (TimeGrid.tsx) remonte au début d'un bloc coupé (borné à 160 px pour garder « maintenant » visible).
- P1 toasts : `dismissInfoToasts()` (toast-store.ts, ajout sans changement des fonctions existantes) appelée avant la suppression d'un événement ; les erreurs et toasts à « Annuler » ne sont jamais retirés.
- P2 Semaine : dégradé de bord droit tant que la grille n'est pas défilée jusqu'au bout ; message « Rien de prévu cette semaine. » (seulement si les événements sont fiables).
- P2 Mois : légende limitée aux repères présents (« jour férié », « tâche », « événement » au singulier) ; message « Rien de prévu ce mois-ci. ».
- P2 puces de tâche (Jour) : cercle de coche décoratif + contour, titre tronqué dans un `<span>`.
- P2 cibles tactiles : seul le sélecteur de vue passait sous 44 px une fois sa zone `::after` comptée (43,5 → 47,5 px). Les autres constats de B (case à cocher, titre de tâche, « + sous-tâches », puces) mesuraient la boîte visible : leur zone de tap est déjà étendue par `::after` / `hitSlop` à ≥ 44 px, donc rien à corriger.
- P3 : « Le titre est requis. » sous le champ Titre (+ `aria-invalid`/`aria-describedby`), l'échec d'enregistrement reste près du bouton ; raccourcis d'échéance du formulaire tâche en grille 2×2 (plus d'orphelin).
- Non traité volontairement : select natif « Durée » (liste de valeurs trop longue pour un segmenté), jour férié du 25 déc. non visible sur la capture (à vérifier avec de vraies données), heure AM/PM (locale du navigateur de test).
- Tests : `grille.test.ts` (5 cas), `toast-store.test.ts` (3), `e2e/agenda.spec.ts` (5 scénarios × desktop/mobile). Suite unitaire 2406/2406, e2e agenda + aujourdhui + taches + parite verts.
- Captures après correctifs : `apres-correctifs/`.

## Scores Nielsen (A) : 26/40
Visibilité 3, correspondance 3, contrôle 3, cohérence 2, prévention 2, reconnaissance 3, flexibilité 3, minimalisme 3, récupération 2, aide 2.
