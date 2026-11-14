# Refonte modules : cohérence interne de « Aujourd'hui » (écran du jour, `/`)

Date : 2026-11-14. Lecture seule (code et base intacts). Banc : app :3100 + faux Supabase :54321, sans `--reset`.

## Résumé

- L'écran fusionné (2026-11-10) est lisible et rapide pour les gestes de coche et de séance ; la hiérarchie score → frise → tâches → retard est cohérente avec PRODUCT.md.
- Le point faible est la **création** : trois entrées concurrentes (barre « Ajoute… », FAB, carte Repas) aux libellés et aux nombres de taps différents, et la barre « Ajoute… » est plantée avant le score.
- Un vestige de la fusion : le message d'échec de la saisie naturelle renvoie vers un champ « ci-dessous » qui n'existe plus (`saisie.ts:83`), et les 4 scénarios de l'audit précédent sont obsolètes (formulaire `AjoutRapideTache` supprimé au lot 3).
- Écarts de vocabulaire GLOSSARY : « Créer une habitude », « Valider » (aperçu de saisie), « Ajouter un repas » qui ne fait que naviguer.
- Cohésion : l'écran « du jour » mélange du hebdomadaire (Séances de la semaine, Pesée de la semaine, Revue) ; le score répète des chiffres déjà affichés juste dessous (tâches, kcal).

## Inventaire des écrans et sections

Un seul écran, route `/` (`src/app/(app)/page.tsx`) ; `/aujourdhui` redirige (`aujourdhui/page.tsx`). Ordre réel dans `_accueil/AujourdhuiView.tsx` :

| # | Section | Rôle | Fichier |
|---|---|---|---|
| 0 | En-tête date + « Bonjour/Bonsoir » (h1) + bouton Réveil (haut droite) | Repère, calcul d'heure de réveil | `page.tsx`, `ReveilButton.tsx` |
| 1 | Barre « Rechercher dans Kilio… » | Recherche globale | `GlobalSearchBar.tsx` |
| 2 | Barre « Ajoute… ex. dentiste jeudi » + bouton « Ajouter » | Saisie en langage naturel (Gemini), aperçu modifiable puis « Valider » | `SaisieNaturelle.tsx`, `ApercuSaisie.tsx` |
| 3 | Pastille jour férié (si besoin) | Info | `FerieBadge` |
| 4 | Score du jour (anneau + lignes par domaine) | Synthèse, disparaît sans domaine | `ScoreDuJourCard.tsx`, `lib/aujourdhui/score.ts` |
| 5 | Journée (frise, repliée si plus rien à venir : « Voir la frise ») | Événements + tâches horodatées + trous libres | `DayTimeline.tsx` |
| 6 | Tâches (x/y faites, « Planifier », « Faites (n) » repliées) | Gestes quotidiens | `TachesDuJour.tsx`, `DashboardTaskItem.tsx`, `PlanifierPanneau.tsx` |
| 7 | En retard (compact, reporter) | Rattrapage | `EnRetardSection.tsx` |
| 8 | Habitudes | Coche rapide | `DashboardHabitudesSection.tsx` |
| 9 | Repas (kcal et macros restants, lien vers le Carnet) | Reste à manger | `RepasRestantsCard.tsx` |
| 10 | Séances de la semaine + bascule « jour d'entraînement » | Lancer une routine | `SeancesCard.tsx`, `EntrainementBouton.tsx` |
| 11 | Pesée de la semaine (seulement si due ou `?peser=1`) | Saisie poids / taille | `PeseeCard.tsx` |
| 12 | Carte Revue (sortie du repli le jour de revue) | Lien vers `/revue` | `AujourdhuiView.tsx:159-176` |
| 13 | Repli « Plan, jour libre et revue » : Plan du jour, Jours libres, Revue | Occasionnel | `PlanDuJourCard.tsx`, `JourLibreCard.tsx` |
| 14 | FAB « + » (éventail Notes / Événement / Tâches / Courses / Repas) | Création rapide | `QuickAddFab.tsx` |
| 15 | Modale « Modifier l'événement » (tap sur un bloc de frise) | Édition | `EvenementForm.tsx` |

Captures : `reports/audit/aujourdhui/ecrans/` (clair, sombre, pleine page) ; parcours : `reports/audit/aujourdhui/parcours-v2/` (FAB, coche et score, planifier, sombre + Carnet).

## Constats

### A. Parcours et hiérarchie

- **A1 (moyenne). Deux champs quasi identiques avant le score.** Recherche puis « Ajoute… » occupent ~150 px ; le score démarre à y ≈ 260 sur 844 (`ecrans/aujourdhui.clair.png`). Le « + » vs la loupe les distingue (`SaisieNaturelle.tsx:62`), mais la saisie est un geste occasionnel, tandis que la première information du jour (score, tâches) est repoussée sous deux barres d'entrée.
- **A2 (haute). Trois chemins de création, trois coûts.**
  - Tâche via FAB : « + » → « Tâches » → titre → « Ajouter » = 4 taps (`parcours-v2/fab-ajouter-tache/05`).
  - Phrase libre : champ → texte → « Ajouter » → « Valider » = 3 taps + dépendance Gemini (quota 8/min, `saisie.ts`).
  - Repas : carte « Repas / Ajouter un repas » → arrive sur le Carnet (`parcours-v2/sombre-repas-revue/05`) où il faut retaper « Ajouter un repas » = au moins 3 taps ; le FAB « Repas » ouvre directement le sélecteur (2 taps). Le geste le plus coûteux est exposé sous le libellé le plus prometteur.
- **A3 (moyenne). Les gestes fréquents de coche sont bien placés** (tâche 1 tap, habitude 1 tap, pastille de routine 1 tap, pesée inline). Point positif à préserver.
- **A4 (moyenne). Section Repas au même niveau que Tâches/Habitudes mais sans geste de coche** : c'est de l'information (restant) plus un lien ; elle précède les Séances. Ordre acceptable (documenté), mais le CTA est mal calibré (voir B2).
- **A5 (basse). « Plan du jour » enfoui dans un repli alors que « Planifier » est exposé sur chaque tâche** : deux manières de placer une tâche dans un trou libre (`TachesDuJour.tsx` vs `PlanDuJourCard.tsx`), l'une visible, l'autre cachée sous « Plan, jour libre et revue ». Le repli est un choix documenté (PRODUCT) ; seul le doublon fonctionnel est à examiner.
- **A6 (basse). Fin de page chargée** : après le repli, FAB flottant qui masque le bas des cartes (`parcours-v2/planifier-et-pesee/03`, bouton « Planifier » sous le FAB) ; compensé par un padding de 110 px mais la dernière ligne reste sous le « + » en milieu de défilement.
- **A7 (basse). Aucun titre d'écran « Aujourd'hui »** : le h1 est « Bonjour/Bonsoir » (`page.tsx:40`) alors que l'onglet, GLOSSARY (Pesée « saisi depuis Aujourd'hui ») et PRODUCT parlent d'« Aujourd'hui ».

### B. Vocabulaire et gestes

- **B1 (moyenne). « Créer une habitude »** (`DashboardHabitudesSection.tsx:39`) : GLOSSARY, entrée **Ajouter** : « Créer » n'apparaît plus dans un libellé de création. Attendu : « Ajouter une habitude ».
- **B2 (haute). « Ajouter un repas » n'ajoute pas** : lien vers `/nutrition/journal` (`RepasRestantsCard.tsx:62,70`). Écart de geste, et le FAB utilise le même mot pour un vrai ajout direct (`QuickAddFab.tsx:205`).
- **B3 (moyenne). « Valider »** comme bouton de création dans l'aperçu (`ApercuSaisie.tsx:388,411`), alors que GLOSSARY met « Valider » dans les mots à éviter pour créer/modifier. Incohérence interne dans le même flux : la barre dit « Ajouter », le titre de la modale « Vérifie avant d'ajouter », le bouton final « Valider ». PRODUCT.md (saisie) documente « Valider » : à arbitrer explicitement, pas à changer en silence.
- **B4 (haute). Message d'erreur périmé** : « Ajoute-la comme tâche ci-dessous » (`src/app/actions/saisie.ts:83`) ; aucun champ de tâche n'existe plus sous la barre (formulaire supprimé au lot 3, commit 1fdd88b ; visible dans `parcours/saisie-naturelle/07`). C'est justement le message affiché quand Gemini est indisponible ou en quota.
- **B5 (basse). Libellés FAB sans verbe** (« Repas », « Courses », « Tâches », « Notes », « Événement ») alors que leurs `aria-label` disent « Ajouter un repas / une tâche… » mais « Courses » seul (`QuickAddFab.tsx:231`). Cohérent avec le motif icône + nom, mais incohérent avec la charte sur « Courses » (ne dit pas qu'on ajoute un article).
- **B6 (basse). Mélange des titres de section** : `sectionTitle` (Score, Pesée) vs `text-body font-semibold` (Tâches, Repas, Séances, Habitudes, En retard) ; « Journée » est hors carte alors que toutes les autres sections sont des cartes (déjà signalé « non traité » dans `reports/2026-11-10-aujourdhui-audit-corrections.md`).
- **B7 (basse). « Plan du jour » (carte) vs « Planifier » (pastille) vs « Plan » dans le titre du repli** : trois emplois de la racine dans le même écran pour deux fonctions voisines.

### C. Cohésion fonctionnelle

- **C1 (moyenne). Doublons d'information avec le score** : Tâches « 2/3 » apparaît dans le score et « 2/3 faites » dans la carte Tâches juste dessous ; Nutrition « 652 / 2100 kcal » dans le score et « 1448 kcal restantes » dans la carte Repas. Le score est un résumé voulu (PRODUCT) ; le coût est visuel plus que fonctionnel.
- **C2 (moyenne). Hebdomadaire sur un écran « du jour »** : Séances de la semaine (aucune date), Pesée de la semaine, carte Revue de la semaine. Documenté (PRODUCT) mais les trois ont des logiques d'apparition différentes (toujours / si due ou `?peser=1` / replié sauf jour de revue). La Revue a même deux emplacements possibles (`AujourdhuiView.tsx:156,178`).
- **C3 (moyenne). Bascule « jour d'entraînement » rangée dans la carte Séances** alors qu'elle commande la cible nutrition et le score (Sport et Nutrition) : son effet est ailleurs que son emplacement (`SeancesCard.tsx`, `EntrainementBouton.tsx`).
- **C4 (basse). Jour libre rangé dans le repli** alors qu'il pilote la limite kcal affichée dans Repas et le score ; cohérent avec l'usage occasionnel (2 jetons/semaine), à garder, mais le lien visible n'existe qu'au titre « Aujourd'hui : jour libre » une fois posé.
- **C5 (basse). Bouton Réveil (calcul de cycles de sommeil) en haut à droite** : fonction isolée, sans lien avec les sections ; il vit dans la coquille statique (`page.tsx:57-61`). Orphelin thématique (voir inter-modules).
- **C6 (basse). Documentation d'audit obsolète** : `reports/2026-11-10-aujourdhui-audit-corrections.md` item 3 et ses tests citent `AjoutRapideTache`, composant disparu ; seul `e2e/aujourdhui.spec.ts:137` garde un `toHaveCount(0)` sur « Ajouter la tâche ».

## Propositions

**P1. Corriger le message d'échec de la saisie (B4).**
Changement : remplacer « Ajoute-la comme tâche ci-dessous » par « Ajoute-la avec le bouton + ». Effet : le message mène à une action existante. Effort S. Risque faible (test éventuel sur la chaîne). Fichiers : `src/app/actions/saisie.ts`, tests associés. Dépend de : rien.

**P2. Aligner les libellés sur la charte (B1, B2, B3-partie, B5).**
- « Créer une habitude » → « Ajouter une habitude ».
- Carte Repas : l'intitulé du lien devient « Ouvrir le Carnet » (navigation), ou bien faire un vrai ajout (voir P3).
- Aperçu de saisie : arbitrer « Valider » (documenté PRODUCT) contre « Ajouter » (charte). Recommandation : « Ajouter (n) », titre « Vérifie avant d'ajouter » déjà aligné ; **contredit PRODUCT.md (saisie)**, à signaler et mettre à jour dans les deux.
Effet : un verbe par geste. Effort S. Risque faible (tests `SaisieNaturelle.test.tsx`, `ApercuSaisie` et e2e à ajuster). Fichiers : `DashboardHabitudesSection.tsx`, `RepasRestantsCard.tsx`, `ApercuSaisie.tsx`, `PRODUCT.md`. Dépend de : décision sur « Valider ».

**P3. Rendre l'ajout de repas direct depuis la carte Repas (A2, B2).**
Changement : bouton « Ajouter un repas » dans la carte qui ouvre le sélecteur déjà utilisé par le FAB (`QuickAddFab` mode `repas`) ; le reste de la carte reste un lien vers le Carnet. Effet : 2 taps au lieu de 3+, le libellé dit vrai. Effort M. Risque moyen (extraire le sélecteur du FAB, deux déclencheurs). Fichiers : `RepasRestantsCard.tsx`, `QuickAddFab.tsx` (ou composant partagé). Dépend de : P2 pour le nom du lien.

**P4. Déplacer la barre « Ajoute… » sous le score ou la replier (A1).**
Option A : score en premier, puis barre de saisie. Option B : barre repliée en bouton ; sa fonction recoupe déjà le FAB. Effet : l'information du jour apparaît dans le premier écran. Effort S (option A) / M (B). Risque moyen : change la première impression, la saisie perd sa position « naturelle » en haut ; le choix de placer la saisie sous la recherche est documenté (`reports/2026-08-31-bouton-flottant-accueil.md` et PRODUCT), à confirmer avec Vincent. Fichiers : `page.tsx`. Dépend de : rien.

**P5. Aligner la mise en page des sections (B6).**
Un seul style de titre de section et « Journée » dans le même contenant que les autres. Effet : lecture uniforme. Effort S. Risque faible (déjà identifié « à décider » le 10/11). Fichiers : `DayTimeline.tsx`, `DashboardHabitudesSection.tsx`, `lib/ui.ts`. Dépend de : rien.

**P6. Clarifier les hebdomadaires (C2, C3).**
Regrouper Séances, Pesée et Revue dans un bloc « Cette semaine » placé après les sections du jour, et déplacer la bascule « jour d'entraînement » près du score ou de Repas (ou la préciser « Cible repas : jour d'entraînement »). Effet : un écran du jour dont chaque bloc est lisible comme « jour » ou « semaine ». Effort M. Risque moyen (contredit en partie « Ordre : … repas, séances, pesée » de PRODUCT, à signaler). Fichiers : `AujourdhuiView.tsx`, `SeancesCard.tsx`. Dépend de : décision produit.

**P7. Unifier les deux outils de placement de tâches (A5, B7).**
Soit « Planifier » ouvre le même panneau que « Plan du jour », soit « Plan du jour » sort du repli quand des tâches sans heure existent. Effet : un seul modèle mental. Effort M. Risque moyen. Fichiers : `PlanDuJourCard.tsx`, `PlanifierPanneau.tsx`, `TachesDuJour.tsx`. Dépend de : rien.

**P8. Ménage des documents et scénarios (C6).**
Réécrire `reports/audit/aujourdhui/scenarios/01-04` pour la structure actuelle (FAB + « Marquer « X » comme fait »), annoter l'item 3 de `reports/2026-11-10-aujourdhui-audit-corrections.md`. Effet : audit rejouable. Effort S. Risque nul. Fichiers : `reports/audit/aujourdhui/scenarios/`, rapport du 10/11. Dépend de : rien.

## Pistes inter-modules

- **Nutrition ↔ Aujourd'hui** : la carte Repas et le FAB Repas ouvrent deux chemins vers le même sélecteur (P3) ; le Carnet pourrait recevoir un paramètre `?ajouter=1` pour ouvrir directement le sélecteur.
- **Réveil** (`ReveilButton.tsx`) : outil de sommeil sans module d'accueil ; candidat à Plus ou Réglages, ou à un module « Sommeil ». À trancher hors Aujourd'hui.
- **Pesée** : saisie ici, consultation dans Nutrition › Bilan (`BilanSante.tsx:14`, lien `/?peser=1`) : le Bilan renvoie vers un écran du jour pour saisir ; un formulaire dans le Bilan éviterait l'aller-retour (contredit le choix documenté « seul endroit où l'on saisit »).
- **Séances / Musculation** : la carte invite à « donner un type à tes routines dans Musculation » sans lien (texte brut).
- **Revue** : carte d'accès ici et écran dédié ; doublon éventuel avec Tâches › En retard (la Revue réutilise `EnRetardSection`).
- **Création** : le FAB est partagé par tous les modules ; toute modification des libellés (B5) concerne les autres écrans.

## Ce qui n'a pas pu être testé

- **Artefacts du faux Supabase / banc** : Gemini sans clé, donc la saisie naturelle n'aboutit qu'au message d'échec (vrai bug de texte B4, mais aperçu et « Valider » non observés en réel) ; aucune habitude ni routine Push/Pull/Legs dans les données (cartes vides, pastilles de séance, coche d'habitude non testées) ; nav de la barre du bas du banc (Aujourd'hui, Agenda, Tâches, Notes, Plus) différente du défaut documenté (Aujourd'hui · Courses · Nutrition · Tâches), à ne pas lire comme un bug ; l'état du faux Supabase est partagé entre agents (2/3 puis 3/3 tâches faites en cours d'audit).
- **Scénarios** : 01, 02, 03, 04 échouent car obsolètes (formulaire supprimé, nom de bouton changé) ; mes parcours « planifier » (aucune tâche à faire restante) et pesée (sélecteur `spinbutton` introuvable) n'ont pas abouti : à ne pas compter comme bugs.
- **Horloge** : le banc tourne le soir, donc la frise est toujours repliée (« Plus rien de prévu ») ; la grille horaire complète, le bloc d'événement et le tap vers la modale n'ont pas été capturés ; jour férié et jour de revue (dimanche) non rencontrés.
- Non testables ici : base réelle, notifications, rappels, gestes tactiles fins (swipe entre onglets, pull-to-refresh), ressenti d'usage (jugements A1, A6, C1 à C5).
- Les captures tournent sur un Chromium local (`/opt/pw-browsers/chromium-1243`) via des copies des scripts d'audit dans le scratchpad (le chromium attendu par le plugin est absent) ; les scripts du plugin n'ont pas été modifiés.
