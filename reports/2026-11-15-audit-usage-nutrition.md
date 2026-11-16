# Audit d'usage : module Nutrition (2026-11-15)

App lancée en build de production contre le faux Supabase local (`e2e/mock-supabase.mjs`, seed fictif `e2e/seed-audit/nutrition.mjs`). Aucune donnée réelle, aucun appel à la base réelle, aucun appel IA. Audit mené sur deux jours (15 et 16 novembre) : les dates du seed sont relatives, donc « aujourd'hui » est un dimanche dans les parcours 1, 2, 3 et 6, un lundi dans les parcours 4 et 5.

Planche complète : `reports/audit/nutrition/index.html`.

## 1. Périmètre

Routes (6 écrans, mobile 390 × 844, clair et sombre, `reports/audit/nutrition/ecrans/`, 12 captures, aucun débordement ni erreur) : `/nutrition` (= Carnet), `/nutrition/journal`, `/nutrition/bilan`, `/nutrition/menus`, `/nutrition/recettes`, `/nutrition/recettes/[id]`.

Parcours joués (`reports/audit/nutrition/scenarios/`, pellicule dans `reports/audit/nutrition/parcours/<nom>/`) :

| Parcours | Thème | Contenu | Résultat |
|---|---|---|---|
| `1-carnet-ajout-suppression` | clair | ajout d'un aliment (quantité portée à 180 g), ajout d'une recette (1,5 portion), suppression + « Annuler », suppression définitive, rechargement | 21 étapes, toutes passées |
| `2-carnet-jours-limites` | sombre | changement de jour, recherche sans résultat, quantité vide / 0 / 99999, double tap sur valider, jour vide, date invalide dans l'URL | 19 étapes passées, 1 constat (D1) |
| `3-menus-mange` | clair | cocher « mangé », vérifier le Carnet, décocher, double tap sur la coche, retirer + « Annuler », bascule entraînement | 20 étapes, toutes passées |
| `4-menus-courses-copie` | clair | ajouter un repas à un créneau, « Envoyer aux Courses » deux fois, liste de courses, semaine suivante, « Copier la semaine précédente », rechargement, retour arrière | 24 étapes, toutes passées |
| `5-recette-creer-modifier` | clair | recherche par ingrédient, création (nom vide, nom très long, double tap), modification du nom, ajout d'un ingrédient à la pièce | bug B1 reproduit ; 4 dernières étapes en échec par la faute du script (voir plus bas) |
| `6-bilan-objectifs` | sombre | Bilan, objectifs (champ vide, nouvelle cible, rechargement), fiche recette au nom long | 16 étapes, toutes passées |

Non testé : base réelle ; fonctions IA (saisie par chat, import de recette) ; notifications push (alerte kcal, rappel de saisie) ; gestes fins (balayage jour par jour du Carnet) ; hors-ligne réel ; saisie d'une pesée (elle se fait depuis Aujourd'hui, hors module) ; étapes d'une recette (ajout, suppression) ; modification de la quantité d'un repas déjà saisi (le geste n'existe pas : supprimer puis ressaisir, déjà noté A1 dans `reports/refonte-modules/nutrition.md`) ; bascule repos/entraînement depuis le Carnet (elle n'y existe pas, elle a été jouée depuis Menus).

## 2. Problèmes

### Bugs

**B1. Une recette dont un ingrédient se compte à la pièce a des kcal fausses (haute).**

- Étapes : fiche d'une recette de 3 portions → « Choisir un ingrédient » : Œuf entier (aliment à la pièce, 55 g la pièce, 145 kcal / 100 g) → quantité 3 (le champ indique « pièce ») → « Ajouter l'ingrédient ».
- Attendu : 3 œufs = 165 g, soit 239 kcal, donc environ 80 kcal par portion.
- Observé : **1,4 kcal par portion** (`parcours/5-recette-creer-modifier/22-reload.png`). Même erreur partout où la recette est comptée : « Omelette aux trois œufs, 1 portion, 46 kcal » dans Menus (`parcours/4-menus-courses-copie/11-click.png`, attendu environ 280), dans la feuille d'ajout (« 46 kcal / portion », `04-wait.png`), donc aussi dans le Carnet, le résumé du jour, le Bilan et la liste des recettes.
- Cause : `nutritionRecette` (`src/lib/nutrition/compute.ts:62-73`) multiplie `quantite / 100` par les valeurs pour 100 g, quelle que soit l'unité. Or un ingrédient à la pièce est enregistré en nombre de pièces (`src/app/actions/recette-ingredients.ts:28`, unité reprise de l'aliment par `IngredientManager.tsx:166`), alors que le Carnet convertit les pièces en grammes avant l'écriture (`src/lib/nutrition/compute.ts:232`). 3 pièces sont donc comptées comme 3 g.
- Portée : toute recette « manuelle » avec un ingrédient à la pièce ayant un poids unitaire. Les recettes à valeurs imprimées (HelloFresh, `kcal_portion` renseigné) ne sont pas touchées. Les kcal sont sous-estimées, ce qui fausse le suivi dans le mauvais sens pour un objectif de perte de poids.
- Confiance : haute sur le code et la reproduction ; moyenne sur l'ampleur réelle (dépend du nombre d'aliments à la pièce dans la base réelle, non consultée).

Aucun autre bug : pas d'erreur console propre à l'app, pas de débordement horizontal, aucune écriture manquante ou en double.

### Écritures vérifiées (faux Supabase, `/__writes`)

| Geste | Écritures observées | Verdict |
|---|---|---|
| Ajouter un aliment au Carnet (180 g) | 1 `POST journal_repas` (quantité 180) | conforme |
| Ajouter une recette (1,5 portion) | 1 `POST journal_repas` (quantité 1.5) | conforme |
| Supprimer + « Annuler » | aucune écriture | conforme |
| Supprimer (toast expiré) | `PATCH menus_repas` (délie un éventuel menu) puis `DELETE journal_repas` | conforme |
| Double tap sur « Ajouter » (Carnet) | 1 seul `POST journal_repas` | pas de doublon |
| Cocher « mangé » | `PATCH menus_repas {mange:true}` → `POST journal_repas` → `PATCH menus_repas {journal_repas_id}` ; le repas apparaît au Carnet | conforme |
| Décocher | `DELETE journal_repas` → `PATCH menus_repas {mange:false, journal_repas_id:null}` ; le repas quitte le Carnet | conforme |
| Double tap sur la coche | validation puis annulation, état final « à manger », aucune entrée orpheline | conforme |
| Retirer un repas du menu + « Annuler » | aucune écriture | conforme |
| Bascule entraînement | 1 upsert `jours_entrainement`, cible du jour passée de 2 100 à 2 500 kcal | conforme |
| Ajouter un repas à un créneau | 1 `POST menus_repas` | conforme |
| « Envoyer aux Courses », 1er envoi | 1 `POST courses_items` de 20 articles, quantités additionnées, toast « 20 articles ajoutés aux Courses · Voir » | conforme |
| « Envoyer aux Courses », 2e envoi | **aucune écriture** | pas de doublon |
| « Copier la semaine précédente » | 1 `POST menus_repas` de 14 repas, tous « à manger », présents après rechargement | conforme |
| Créer une recette, double tap | 1 seul `POST recettes` | pas de doublon |
| Modifier une recette | 1 `PATCH recettes` | conforme |
| Objectif avec champ vide | aucune écriture | conforme |
| Objectif 2 050 kcal | 1 upsert `objectifs_nutritionnels`, relu après rechargement | conforme |

### Design

**D1. Quatre taps rapides sur « Jour précédent » ne reculent que d'un jour (moyenne).** Parcours 2, étapes 2 à 5 : quatre taps en 1,5 s, l'URL n'a changé qu'ensuite et l'ajout suivant est écrit à J-1. Les flèches sont des liens serveur dont la cible ne change qu'une fois le nouveau jour rendu (`journal/JournalNavigationJour.tsx:35-50`). Avec la latence du mock (400 ms par requête) c'est très visible ; en réel l'effet dépend du réseau. Confiance moyenne. Voir P2.

**D2. Noms de recettes coupés dans Menus (moyenne).** « Pâtes complètes à la … », « Saumon rôti, brocoli … », « Dahl de lentilles corai… » (`ecrans/nutrition_menus.sombre.png`) : `menus/LigneMenu.tsx:91` tronque sur une ligne, alors que le Carnet affiche le nom entier. Deux recettes commençant pareil deviennent indistinguables. Voir P3.

**D3. Une recette manuelle sans étape n'a aucun moyen d'en recevoir (moyenne).** La section « Étapes » n'est rendue que pour une recette HelloFresh ou ayant déjà des étapes (`recettes/[id]/page.tsx:88`) ; la fiche d'une recette créée à la main s'arrête aux ingrédients (`parcours/5-recette-creer-modifier/22-reload.png`). Peut être voulu ; à trancher. Voir P4.

**D4. Titre de fiche recette serré par les boutons (basse).** « Modifier » et « Supprimer » occupent la moitié de la largeur à côté du titre, qui passe sur trois lignes dès 25 caractères (`ecrans/nutrition_recettes__id_.sombre.png`). Voir P5.

### Libellés

**L1. Décimales au point et précision inégale sur la fiche recette (basse).** « 274.9 kcal », « 27.4g » (`ecrans/nutrition_recettes__id_.sombre.png`) : `fmt` de `recettes/[id]/RecetteMacros.tsx:25-28` rend un point décimal et colle l'unité, alors que le reste de l'app écrit « 275 kcal » et « 1,5 portion ». Voir P6.

**L2. « 3 pièce » sans accord (basse).** `IngredientManager.tsx:62` affiche l'unité telle quelle. Voir P6.

**L3. Majuscules de titre sur les dates (basse).** « Dimanche 15 Novembre », « Semaine Du 23 – 29 Nov. » : la classe `capitalize` met une majuscule à chaque mot (`journal/JournalJour.tsx:24`, `menus/NavigationSemaine.tsx:23`). Voir P7.

### Échecs de parcours qui ne sont pas des défauts de l'app

- Parcours 5, étapes 24 et 27 à 30 : le script remplit le champ quantité juste après un rechargement, avant que le formulaire soit actif. Le reste du parcours (dont B1) n'en dépend pas.
- Les 54 « problèmes » comptés par `index.html` sont, hors B1 et ces étapes, les artefacts ci-dessous.

### Artefacts du faux Supabase et du rig

- `GET /_vercel/speed-insights/script.js` → 404 à chaque chargement : script servi par Vercel uniquement.
- Requêtes `?_rsc=…` et `POST` d'action « net::ERR_ABORTED » : préchargements et actions interrompus par la navigation suivante du script.
- `POST jours_feries` au premier chargement : cache des jours fériés, vide dans le mock.
- Le `POST journal_repas` de la validation « mangé » contient `id`, `mange`… : le mock renvoie la ligne entière au lieu d'appliquer le `select` du `PATCH` ; en base réelle seules `date, moment, aliment_id, recette_id, quantite` reviennent (`src/app/actions/menus.ts:66`).
- Les fonctions RPC renvoient `[]` dans le mock.

## 3. Propositions

Les propositions P1 à P12 de `reports/refonte-modules/nutrition.md` (2026-11-14) restent la référence et ne sont pas rouvertes ; celles-ci s'y ajoutent.

- **P1. Unité des ingrédients à la pièce (suite de B1).** Le correctif proposé en PR convertit les pièces en grammes au moment du calcul. Autre option : enregistrer les ingrédients en grammes comme le Carnet, ce qui demande de migrer les lignes existantes. Recommandation : le calcul d'abord (aucune donnée à réécrire), la migration seulement si un autre besoin la justifie.
- **P2. Changement de jour (D1).** Options : (a) laisser tel quel ; (b) flèches côté client qui cumulent les taps sur la date affichée ; (c) désactiver les flèches pendant la transition. Recommandation : (b), car remonter de plusieurs jours est un geste courant pour corriger un oubli.
- **P3. Noms dans Menus (D2).** Options : (a) deux lignes maximum ; (b) nom entier comme au Carnet. Recommandation : (a), qui garde la ligne compacte et lève l'ambiguïté.
- **P4. Étapes d'une recette manuelle (D3).** Options : (a) toujours montrer la section avec son formulaire d'ajout ; (b) un lien discret « Ajouter des étapes » ; (c) garder ainsi si les recettes manuelles n'ont pas vocation à en avoir. Recommandation : (b).
- **P5. En-tête de fiche recette (D4).** Options : (a) boutons sous le titre ; (b) « Supprimer » dans le formulaire de modification. Recommandation : (a), sans changer les gestes.
- **P6. Nombres de la fiche recette (L1, L2).** Recommandation : kcal arrondies à l'entier, macros à une décimale avec virgule et espace avant l'unité, « pièces » accordé.
- **P7. Dates (L3).** Recommandation : majuscule au premier mot seulement (« Dimanche 15 novembre », « Semaine du 23 au 29 nov. »).

## 4. Critique impeccable (synthèse)

Le skill `kilaskills:impeccable` n'était plus proposé dans la session à ce stade et aucun sous-agent isolé n'était disponible : les deux évaluations (A : regard design sur les captures, B : contrôle mécanique à partir des relevés du script) ont été faites à la suite par le même agent, sans isolement. C'est une limite de cette critique.

- **Carnet** (`ecrans/nutrition_journal.clair.png`). Hiérarchie claire : anneau kcal, trois barres, repas. Le bloc « Objectif (repos) » avec son seul lien « Modifier les objectifs » occupe la meilleure place de l'écran pour un geste rare (déjà A3 du rapport du 14). Le bouton flottant recouvre le bouton « Supprimer » de la ligne placée derrière lui tant qu'on ne fait pas défiler.
- **Feuille d'ajout** (`parcours/2-carnet-jours-limites/13-fill.png`). Très bonne : jour rappelé dans le titre, pas et raccourcis de quantité, kcal en direct, erreurs en clair (« Maximum 41 pièces »), validation désactivée tant que la saisie est invalide.
- **Menus** (`ecrans/nutrition_menus.sombre.png`, `parcours/4-menus-courses-copie/11-click.png`). Dense mais lisible ; la coche, le total du jour et le reste à manger se comprennent sans légende. Points faibles : noms tronqués (D2), haltère sans libellé visible, et l'ouverture sur le jour courant laisse « Envoyer aux Courses » hors écran (déjà A5).
- **Bilan** (`ecrans/nutrition_bilan.clair.png`). Quatre tuiles nettes. Le bouton plein « Peser » sous une phrase d'explication fait sortir du module (déjà A4, choix documenté au glossaire).
- **Recettes et fiche** (`ecrans/nutrition_recettes__id_.sombre.png`). La fiche est l'écran le moins fini : en-tête serré (D4), nombres bruts (L1), deux boutons par ingrédient qui allongent la liste.
- **Cohérence entre écrans.** Sous-navigation identique sur les quatre onglets, thème sombre fidèle au clair, suppression avec « Annuler » partout, mêmes couleurs de macros. Écarts : nom entier au Carnet contre tronqué dans Menus, kcal entières partout sauf sur la fiche recette.
- **Contrôle mécanique.** 12 captures au repos et 6 parcours sans débordement horizontal ni erreur console propre à l'app ; cibles tactiles vues à 44 px ou plus ; toutes les cibles des parcours atteintes par rôle ou libellé accessible. La page derrière une feuille ouverte reste exposée aux sélecteurs par rôle (un bouton du menu portant le même nom qu'un résultat de recherche a été trouvé avant celui de la feuille) : à vérifier au lecteur d'écran, non tranché ici.

## 5. Corrections

À venir : une PR pour B1.
