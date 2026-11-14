# Refonte de cohérence — module Nutrition

Lecture seule. Date : 2026-11-14. Périmètre : `src/app/(app)/nutrition/**` (Carnet, Bilan, Recettes, Menus), `NutritionSubNav`, actions `journal`, `menus`, `sante`, `recettes`. Captures : `reports/audit/nutrition/ecrans/` (6 écrans, clair + sombre) et `reports/audit/nutrition/parcours/` (4 parcours, 30 captures). Les constats de `reports/2026-11-12-audit-design-nutrition.md` ne sont pas refaits : seuls ceux qui touchent la cohérence interne sont repris, avec leur état actuel dans le code.

## Résumé

- Le module est globalement cohérent : hub supprimé (`/nutrition` sert le Carnet), suppression différée avec « Annuler » partout, charte Ajouter/Enregistrer/Supprimer/Retirer respectée dans ~90 % des libellés.
- Incohérences restantes, toutes petites : ordre des moments (Carnet/Menus : petit-déj, déjeuner, collation, dîner ; feuille d'ajout et fiche recette : …, dîner, collation), verbe « Planifier » et « Éditer » hors charte, « Fermer » à la place de « Annuler », préfixe « + » sur les boutons d'ajout des ingrédients/étapes.
- Gestes manquants plutôt que mal placés : impossible de corriger la quantité d'un repas du Carnet ou d'un menu (supprimer puis ressaisir), aucun écran de création/édition d'aliments, aucun lien Menus ↔ Recettes.
- La pesée est saisie hors module (Aujourd'hui) mais le bouton « Peser » est dans le Bilan, et PRODUCT.md décrit encore une saisie depuis le Bilan.
- 12 propositions (P1-P12), dont 8 de taille S sans risque.

## Inventaire des écrans

| Route | Rôle |
|---|---|
| `/nutrition` | Onglet de la barre du bas ; réexporte le Carnet sans redirection (`nutrition/page.tsx`) |
| `/nutrition/journal` | Carnet alimentaire : objectifs (repliés), résumé du jour, repas par moment, bouton flottant « Ajouter un repas », navigation jour par jour (flèches + swipe + lien « Aujourd'hui ») |
| `/nutrition/bilan` | Bilan : synthèse de la semaine, carte Pesée (liste des relevés + « Peser » qui renvoie vers `/?peser=1`), 7 jours, 30 jours, détail de la semaine |
| `/nutrition/menus` | Menus : semaine lundi-dimanche, 4 créneaux × 7 jours, coche « mangé », bascule entraînement, comparaison à la cible, « Envoyer aux Courses », « Copier la semaine précédente » |
| `/nutrition/recettes` | Liste des recettes : recherche (nom + ingrédients), filtres temps/kcal, carte « Ajouter une recette » |
| `/nutrition/recettes/[id]` | Fiche recette : macros par portion, ajout au Carnet (compteur de portions + moment), ingrédients, étapes, édition, suppression |
| (feuilles) | Feuille d'ajout de repas (`AjoutRepasPanneau`), partagée par le Carnet, les Menus et le « + » de l'écran d'accueil |
| (absent) | Aucun écran Aliments : le catalogue n'est alimenté que par le chat / la base |

Navigation interne : `NutritionSubNav`, 4 segments (Carnet, Bilan, Recettes, Menus), présent en tête de chaque écran de premier niveau ; la fiche recette a un `BackLink` « Recettes » à la place.

## Constats

### Axe A : parcours et hiérarchie

**A1. Corriger la quantité d'un repas est impossible (haute-moyenne).** `journal/JournalEntriesList.tsx:39-63` n'offre que « Supprimer » ; `menus/LigneMenu.tsx:93-109` que « Retirer » (croix). Une erreur de dosage (200 g au lieu de 100 g) coûte : supprimer, rouvrir la feuille, rechoisir, ressaisir = 5 taps au lieu de 1-2. Le même défaut est signalé pour l'ajout sans « Annuler » (audit 11-12 I-1) : `AjoutRepasBouton.tsx:34` appelle toujours `showToast` sans action ; `AjoutMenuBouton.tsx:68` idem. En revanche suppression et « mangé » sont annulables : le geste le plus fréquent est le seul sans filet.

**A2. Ajout d'un repas : 3 taps minimum (moyenne).** FAB → choisir un récent ou une recherche → bouton de validation (`AjoutRepasPanneau.tsx:203-210` et `EtapeQuantite`). Capture `parcours/ajout-repas-carnet/03-screenshot.png` : l'écran « Récents » affiche déjà quantité et moment mais chaque ligne ouvre l'étape quantité. Pas de rejeu direct « même quantité ». Option O-2 de l'audit 11-12 reste ouverte. À mettre en balance avec PRODUCT.md (« saisie rapide avant tout »).

**A3. Objectifs en tête du Carnet (moyenne).** `JournalJour.tsx:75-78` : titre « Objectif (repos) » + lien « Modifier les objectifs » passent avant le « Résumé du jour » (capture `nutrition_journal.clair.png`). Geste occasionnel au-dessus du geste quotidien. Le type de jour (repos/entraînement) est affiché mais seul modifiable depuis Menus (`BasculeEntrainementJour`) ou Aujourd'hui : dans le Carnet, où le type conditionne la cible, aucun bouton. Option O-5 de l'audit 11-12.

**A4. La pesée est coupée en deux (moyenne).** `bilan/BilanSante.tsx:28-41` : la carte « Pesée » affiche « Poids et tour de taille se saisissent depuis Aujourd'hui ; le Bilan les affiche » puis un bouton plein « Peser » (`HREF_PESER = "/?peser=1"`). Le bouton principal sort du module (parcours `navigation-onglets/09-screenshot.png` : arrivée sur l'écran d'accueil, ici en squelette de chargement). GLOSSARY.md (Pesée) documente ce choix : à ne pas remettre en cause, mais le texte d'explication est une rustine ; PRODUCT.md dit en revanche « depuis le Bilan nutrition ou la carte… », ce qui est faux (PRODUCT.md ligne « Pesée et bilan de la semaine »). `PeseeForm` vit dans `nutrition/bilan/` mais n'est utilisé que par `_accueil/PeseeCard.tsx:9`.

**A5. Menus : la page s'ouvre sur le jour courant, en-tête hors écran (basse).** `menus/JourMenu.tsx:55` (`scrollIntoView` si `defiler`). Voulu (commentaire en tête du composant), mais la carte « Prévu sur la semaine » avec « Envoyer aux Courses » est donc au-dessus du pli : capture `nutrition_menus.clair.png` montre samedi et dimanche sans contexte. L'action « Envoyer aux Courses » (geste hebdomadaire) est enfouie à l'ouverture.

**A6. Hub supprimé, sous-navigation propre (positif).** `nutrition/page.tsx` : un tap pour atteindre le Carnet depuis la barre du bas. Retour à aujourd'hui : lien « Aujourd'hui » présent (`JournalNavigationJour.tsx:23-31`). Titre de feuille avec le jour hors aujourd'hui : fait (`AjoutRepasBouton.tsx:96`, capture `menus-parcours/08-screenshot.png`). Ces deux points de l'audit 11-12 (I-5) sont donc réglés.

### Axe B : vocabulaire et gestes

**B1. Ordre des moments incohérent (moyenne).** `lib/nutrition/compute.ts:106` : `MOMENTS_REPAS` = petit-déj, déjeuner, dîner, collation (sélecteur de la feuille d'ajout, `AjoutRepasPanneau.tsx:73`, fiche recette `RecetteMacros.tsx:150`). `lib/menus/compute.ts:11` : `CRENEAUX_MENU` = petit-déj, déjeuner, collation, dîner (Menus) et `JournalEntriesList.tsx:15` idem (Carnet). Captures : `parcours/ajout-repas-carnet/03-screenshot.png` (… Dîner, Collation) contre `nutrition_menus.clair.png` (… Collation, Dîner). Le Carnet affiche donc les repas dans un ordre, et la feuille qui les crée propose un autre. Écart déjà noté (audit 11-12 M-1) et toujours présent côté sélecteur.

**B2. « Planifier » et « planifié » (basse).** `menus/AjoutMenuBouton.tsx:23` (`Planifier ${AJOUT_LABELS[moment]}`) et `:67` (toast « planifié … »). GLOSSARY.md ne définit pas « Planifier » ; le bouton d'entrée équivalent dit « Ajouter un repas » (`AjoutMenuBouton.tsx:50`, aria-label identique à celui du Carnet : deux « Ajouter un repas » de portée différente). À trancher : soit « Ajouter au menu », soit inscrire « Planifier » au glossaire.

**B3. « Éditer » au lieu d'un verbe de la charte (basse).** `RecetteHeader.tsx:63`, `IngredientManager.tsx:103`, `IngredientsLibresManager.tsx:102`, `EtapesManager.tsx:111`. Le Carnet dit « Modifier les objectifs » (`ObjectifForm.tsx:126`). La charte ne contient ni « Éditer » ni « Modifier » comme libellé de bouton d'entrée : à décider une fois (suggestion : « Modifier », cohérent avec « Enregistrer »).

**B4. « Fermer » dans un formulaire qui enregistre (basse).** `ObjectifForm.tsx:156` : à côté d'« Enregistrer ». GLOSSARY.md : « Annuler » = fermer un formulaire sans rien enregistrer ; « Fermer » réservé aux feuilles qui n'annulent rien. Les formulaires de recette utilisent bien « Annuler » (`AddRecetteToggle.tsx:33`, `RecetteHeader.tsx:32`).

**B5. Préfixe « + » sur des boutons d'ajout (basse).** `IngredientManager.tsx:207`, `IngredientsLibresManager.tsx:159`, `EtapesManager.tsx:171` : « + Ajouter l'ingrédient / l'étape ». GLOSSARY.md (Ajouter) : « Avoid : + X ». Même défaut pour l'état de chargement : « Ajout... » (trois points ASCII) ici contre « Ajout… » (caractère unique) dans `AjoutRepasPanneau.tsx` et `RecetteMacros.tsx:155`, et « Enregistrement... » dans `ObjectifForm.tsx:152` et `RecetteForm.tsx:203`.

**B6. Verbe « Ajouter au Carnet » vs « Voir le Carnet du jour » (basse).** `RecetteMacros.tsx:155` et `:87` : « Carnet » est la forme courte autorisée, mais le toast de la fiche recette propose « Voir » alors que le toast de l'ajout depuis le Carnet n'a pas d'action : deux patterns pour le même geste (A1).

**B7. Gestes de suppression homogènes (positif, mais vérifier le glossaire).** Toutes les suppressions du module utilisent `supprimerAvecAnnulation` (Carnet, Menus, Pesée, Recettes, ingrédients, étapes) : l'audit 11-12 O-6(a) (dialogue `confirmDelete`) est résolu. Les boutons sont en entier (« Supprimer ») avec `aria-label` contextualisé : M-8 résolu. Le « Retirer » des Menus respecte la charte. Reste le swipe : le Carnet se balaie jour par jour, pas les Menus par semaine (O-6(b)).

**B8. Protéines colorées en dépassement dans le Carnet seulement (moyenne).** `journal/ResumeJour.tsx:133` : la barre « Protéines » passe par `MacroBar` qui applique `severiteDepassement` (triangle + ambre/rouge). `menus/ComparaisonObjectif.tsx:20-22` et PRODUCT.md (« protéines jamais en alerte ») disent le contraire, et le Bilan compte protéines ≥ cible comme réussi. Même écran, deux règles. Audit 11-12 I-3, toujours ouvert.

### Axe C : cohésion fonctionnelle

**C1. Aliments : un maillon sans écran (haute pour la cohérence, produit à trancher).** Le module parle d'aliments partout (feuille d'ajout, ingrédients, `IngredientManager.tsx:154-156` « Aucun aliment en base pour l'instant : impossible de composer cette recette ») mais aucune route ne les crée ni ne les modifie ; aucune Server Action d'écriture sur `aliments` (grep : seules lectures dans `actions/journal.ts` et `recettes/[id]/page.tsx`). Création uniquement par le chat. Le message d'état vide envoie dans une impasse (aucun bouton, aucune consigne). Ce choix est peut-être voulu (PRODUCT.md n'en parle pas) : le signaler plutôt que supposer un manque.

**C2. Menus et Recettes ne se parlent pas (moyenne).** `LigneMenu.tsx:96-98` : le nom d'une recette planifiée n'est pas un lien vers sa fiche ; la fiche recette n'a pas d'« Ajouter au menu » (seulement « Ajouter au Carnet », `RecetteMacros.tsx:155`). Depuis un menu, voir les ingrédients ou les étapes de la recette du soir (usage en cuisine) demande : Recettes → recherche → fiche. Aucune preuve que Vincent le fasse, mais le parcours « je cuisine ce qui est au menu » n'a pas de chemin direct.

**C3. Le type de jour vit à trois endroits (moyenne).** Bascule haltère : Menus (`BasculeEntrainementJour`), Aujourd'hui ; affiché sans action dans le Carnet (`JournalJour.tsx:76`). Les jours libres sont posés depuis Aujourd'hui (`_accueil/JourLibreCard.tsx`) et seulement lus par Menus et Bilan. Ce sont des états de « jour », pas de menu : leur emplacement naturel est discutable, mais ils conditionnent les cibles du module (voir Pistes inter-modules).

**C4. Doublon de point d'entrée de saisie (basse).** « Ajouter un repas » est exposé trois fois : FAB du Carnet, carte vide du Carnet (`JournalRepas.tsx:77` + `JournalJour.tsx:88` coexistent à l'état vide), « + » de l'écran d'accueil. Le doublon FAB/carte à l'état vide est celui déjà signalé (M-15).

**C5. Recettes : fiche en mode édition permanent (basse).** Une fiche recette consultée en cuisine affiche « Éditer »/« Supprimer » sur chaque ingrédient et chaque étape (capture `nutrition_recettes__id_.clair.png`, boutons dès le premier ingrédient). Lecture et modification partagent le même écran (option O-4 de l'audit 11-12).

**C6. PRODUCT.md en retard sur le code (basse).** « Pesée … depuis le Bilan nutrition » (A4) ; l'ordre « petit-déj, déjeuner, collation, dîner » est cité pour les Menus uniquement ; aucune mention des Recettes dans la description des écrans de Nutrition.

## Propositions

Toutes respectent les choix documentés (PRODUCT.md, GLOSSARY.md, rapports existants) sauf mention contraire.

**P1. Un seul ordre des moments : petit-déj, déjeuner, collation, dîner.** Changement : aligner `MOMENTS_REPAS` sur `CRENEAUX_MENU` (ou fusionner les deux constantes) pour le sélecteur de la feuille d'ajout et de la fiche recette. Effet : l'ordre vu dans le Carnet, les Menus et les sélecteurs est identique. Effort S. Risque : faible (affichage ; vérifier `momentParDefaut` et les tests de `ChoixMoment`, `compute.test.ts`). Fichiers : `src/lib/nutrition/compute.ts`, `src/lib/menus/compute.ts`, `journal/JournalEntriesList.tsx` (supprimer `MOMENT_ORDER` local), tests associés. Dépend de : rien.

**P2. Charte des libellés : « Planifier », « Éditer », « Fermer », « + X ».** Changement : (a) trancher « Planifier » (entrée au glossaire) ou « Ajouter au menu » ; (b) remplacer « Éditer » par « Modifier » (et l'inscrire au glossaire comme verbe d'entrée en modification) ; (c) « Fermer » → « Annuler » dans `ObjectifForm` ; (d) retirer le « + » des trois boutons d'ajout et unifier « Ajout… » / « Enregistrement… » (caractère `…`). Effet : un verbe par geste, comme l'exige le GLOSSARY. Effort S. Risque : faible, mais les tests qui cherchent ces libellés changent. Fichiers : `RecetteHeader.tsx`, `IngredientManager.tsx`, `IngredientsLibresManager.tsx`, `EtapesManager.tsx`, `ObjectifForm.tsx`, `AjoutMenuBouton.tsx`, `GLOSSARY.md`, tests (`SuppressionsRecette.test.tsx`, `RecetteHeader.test.tsx`, e2e). Dépend de : décision de Vincent sur (a) et (b), le glossaire ne les tranche pas.

**P3. Toast d'ajout annulable, Carnet et Menus.** Changement : `addJournalEntry` / `addMenuEntry` renvoient l'`id` créé ; le toast de `useAjoutRepasTermine` et d'`AjoutMenuBouton` reçoit une action « Annuler » qui appelle `removeJournalEntry` / `removeMenuEntry` (même motif que `LigneMenu`). Effet : le geste le plus fréquent devient réversible comme tous les autres. Effort M. Risque : contrat de l'action serveur (`JournalFormState` à étendre ; consommateurs : `QuickAddFab` de l'accueil, `RecetteMacros`). Fichiers : `src/app/actions/journal.ts`, `src/app/actions/menus.ts`, `journal/AjoutRepasBouton.tsx`, `menus/AjoutMenuBouton.tsx`, `recettes/[id]/RecetteMacros.tsx`, `app/QuickAddFab.tsx` (hors module). Dépend de : rien ; recoupe l'audit 11-12 I-1.

**P4. Modifier la quantité d'un repas (Carnet et Menus).** Changement : toucher la ligne ouvre la feuille de quantité préremplie (étape `EtapeQuantite` réutilisée) avec « Enregistrer » ; nouvelle action `updateJournalEntry` / `updateMenuEntry`. Effet : corriger un dosage en 2 taps au lieu de 5. Effort M. Risque : moyen (nouvelle action serveur, recalcul de l'entrée liée `journal_repas_id` si le repas du menu est mangé, invalidations de cache `resume-nutrition`). Fichiers : `journal/JournalEntriesList.tsx`, `menus/LigneMenu.tsx`, `journal/AjoutRepasPanneau.tsx`, `src/app/actions/journal.ts`, `src/app/actions/menus.ts`, tests. Dépend de : P3 recommandé avant (même zone). Ajoute un geste : à confirmer avec Vincent (PRODUCT.md n'en parle pas).

**P5. Une seule règle pour les protéines.** Changement : forcer `sev = "ok"` pour la barre protéines dans `MacroBar` ; documenter la règle (« plancher ») dans DESIGN.md. Effet : le Carnet, les Menus et le Bilan disent la même chose. Effort S. Risque : faible ; touche une règle produit déjà écrite (PRODUCT.md : « protéines jamais en alerte » pour les Menus), donc alignement et non contradiction. Fichiers : `journal/ResumeJour.tsx`, `DESIGN.md`, test de `ResumeJour` si présent. Dépend de : validation de Vincent (audit 11-12 I-3).

**P6. Pesée : texte et PRODUCT.md alignés sur le code.** Changement minimal : corriger PRODUCT.md (« saisie depuis la carte Pesée d'Aujourd'hui, consultation et correction dans le Bilan ») et remplacer la phrase de `BilanSante.tsx:38-40` par un libellé de bouton explicite (« Peser (depuis Aujourd'hui) »), sans changer le parcours. Option ambitieuse, signalée comme contraire à GLOSSARY.md (Pesée « saisi depuis Aujourd'hui ») : rouvrir la saisie dans le Bilan en réutilisant `PeseeForm` en feuille. Effet : le Bilan n'envoie plus l'utilisateur quitter le module avec un bouton plein. Effort S (texte) ou M (feuille). Risque : faible / moyen (choix produit documenté). Fichiers : `PRODUCT.md`, `bilan/BilanSante.tsx`, (option) `bilan/PeseeForm.tsx`. Dépend de : décision de Vincent.

**P7. Lier Menus et Recettes.** Changement : le nom d'une recette planifiée devient un lien vers `/nutrition/recettes/[id]` (`recette_id` déjà lu dans `MenusSemaine.tsx`) ; sur la fiche recette, un second bouton « Ajouter au menu » (jour + créneau) à côté d'« Ajouter au Carnet ». Effet : parcours « je cuisine ce qui est prévu » direct, planification depuis la recette. Effort M (lien : S ; bouton : M). Risque : faible (le lien) ; le bouton demande un sélecteur de jour. Fichiers : `menus/MenusSemaine.tsx` (ajouter `recetteId` à `planifie`), `menus/LigneMenu.tsx`, `recettes/[id]/RecetteMacros.tsx`, `src/app/actions/menus.ts`. Dépend de : rien (le lien seul est indépendant).

**P8. Carnet : résumé d'abord, objectifs derrière un bouton ; type de jour modifiable.** Changement : remonter « Résumé du jour » en tête, placer « Modifier les objectifs » en bouton d'en-tête (ou sous le résumé), et réutiliser `BasculeEntrainementJour` près de l'anneau pour changer le type de jour sur place. Effet : le premier écran du geste quotidien montre le chiffre utile ; le type de jour se corrige là où il sert. Effort M. Risque : moyen (hiérarchie visuelle du Carnet, `JournalSwipeWrapper`, tests de page). Fichiers : `journal/JournalJour.tsx`, `journal/JournalRepas.tsx`, `journal/ObjectifForm.tsx`, `menus/BasculeEntrainementJour.tsx` (à déplacer vers `nutrition/` commun). Dépend de : rien (recoupe l'audit 11-12 O-5).

**P9. État vide des Aliments : dire quoi faire.** Changement : remplacer « Aucun aliment en base pour l'instant : impossible de composer cette recette » (`IngredientManager.tsx:156`) par un texte qui indique comment en ajouter (par le chat) ; si Vincent veut un écran, l'ajouter au catalogue (création/modification d'un aliment depuis la feuille d'ajout « Aucun résultat → Ajouter cet aliment »). Effet : plus d'impasse silencieuse. Effort S (texte) / L (écran Aliments). Risque : faible / moyen (nouvelle surface de saisie). Fichiers : `recettes/[id]/IngredientManager.tsx`, (option) `journal/AjoutRepasPanneau.tsx`, nouvelle action `aliments.ts`. Dépend de : décision produit « les aliments restent-ils chat seulement ? ».

**P10. Menus : « Envoyer aux Courses » visible à l'ouverture.** Changement : soit ne pas défiler au jour courant quand la semaine est vide ou entièrement à manger, soit épingler un résumé compact « Envoyer aux Courses » en pied d'écran. Effet : action hebdomadaire atteignable sans remonter. Effort S-M. Risque : faible ; contredit partiellement le choix « la page s'ouvre sur le jour courant » (commentaire de `JourMenu.tsx`), à valider. Fichiers : `menus/JourMenu.tsx`, `menus/MenusSemaine.tsx`. Dépend de : rien.

**P11. Fiche recette : lecture d'abord, modification sur demande.** Changement : masquer « Éditer »/« Supprimer » par ligne derrière un seul bouton « Modifier » (en-tête) qui révèle les contrôles et les formulaires d'ajout. Effet : fiche lisible en cuisine, même pattern que le Carnet (lecture) / formulaire (édition). Effort L. Risque : moyen (trois gestionnaires à refondre, tests `SuppressionsRecette`). Fichiers : `recettes/[id]/page.tsx`, `RecetteHeader.tsx`, `IngredientManager.tsx`, `IngredientsLibresManager.tsx`, `EtapesManager.tsx`. Dépend de : P2 (libellé « Modifier »). Optionnel.

**P12. Mettre PRODUCT.md à jour.** Changement : décrire les Recettes, la sous-navigation à quatre onglets, la pesée telle qu'elle est (P6), l'ordre des moments retenu (P1). Effort S. Risque : nul. Fichiers : `PRODUCT.md`. Dépend de : P1, P6.

Ordre suggéré : P1, P2, P5 (lots S de cohérence) → P3, P7 → P4, P8 → P6/P9/P10 selon décisions → P11, P12.

## Pistes inter-modules

- Pesée : saisie dans Aujourd'hui, consultation dans Nutrition (Bilan) ; envisager de déplacer la carte entière d'un côté.
- Jours libres et bascule entraînement : posés depuis Aujourd'hui, lus par Nutrition ; envisager un point d'entrée unique.
- « Envoyer aux Courses » : action de Menus qui écrit dans Courses ; vérifier le retour (lien vers Courses après envoi).
- Séances : le type de jour vient du module Musculation ; Bilan affiche « Séances 0/3 » (déjà un croisement).
- Carte nutrition de l'écran d'accueil et `QuickAddFab` réutilisent la feuille d'ajout de repas (P3 les touche).

## Ce qui n'a pas pu être testé

- Vrai bug ou artefact : les « problèmes » du relevé automatique sont des artefacts du banc (script `/_vercel/speed-insights/script.js` en 404, requêtes `_rsc` annulées par la navigation). Aucune erreur applicative relevée sur les 4 parcours.
- Le script `ecrans.mjs` / `parcours.mjs` du skill lance le navigateur par défaut, absent dans cet environnement (version Playwright différente de `/opt/pw-browsers`) ; exécutés via une copie dans le scratchpad avec un `executablePath`, sans toucher au dépôt.
- Deux sélecteurs de mon parcours « ajout-repas-carnet » (choix de « Skyr », bouton de validation) n'ont pas été trouvés : la validation d'un ajout et son toast n'ont donc pas été capturés ; le constat A1/P3 repose sur le code (`AjoutRepasBouton.tsx:34`), pas sur une capture. Aucun repas n'a été ajouté dans le faux Supabase.
- Non testés : geste de swipe (jour du Carnet), bascule haltère, coche « mangé », « Envoyer aux Courses », « Copier la semaine précédente » (écritures dans un faux Supabase partagé avec d'autres agents), mode hors ligne, clair/sombre au-delà des captures au repos, mesures de zones de tap sur appareil.
- Le banc place l'onglet Nutrition sous « Plus » (barre du bas par défaut du banc), alors que `DEFAULT_MODULES_BARRE_BASSE` le met en 3e position : l'accès réel de Vincent dépend de ses préférences de navigation, non vérifiables ici.
- La capture « Peser » arrive sur l'accueil en cours de chargement (squelettes) ; la carte « Pesée de la semaine » (`?peser=1`) n'a pas été vue rendue.
