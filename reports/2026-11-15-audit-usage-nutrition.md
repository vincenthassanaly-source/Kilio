# Audit d'usage : module Nutrition (2026-11-15)

> **État : rapport intermédiaire.** Poussé tôt pour ne rien perdre (quota serré). Les écrans au repos et 6 parcours ont été joués ; l'examen visuel des captures, la critique impeccable et les éventuelles PR sont **à venir** (sections marquées).

App lancée en build de production contre le faux Supabase local (`e2e/mock-supabase.mjs`, seed fictif `e2e/seed-audit/nutrition.mjs`). Aucune donnée réelle, aucun appel à la base réelle, aucun appel IA.

## 1. Périmètre

Routes (6 écrans, mobile 390 × 844, clair et sombre, `reports/audit/nutrition/ecrans/`, 12 captures, 0 problème relevé par le script) : `/nutrition` (= Carnet), `/nutrition/journal`, `/nutrition/bilan`, `/nutrition/menus`, `/nutrition/recettes`, `/nutrition/recettes/[id]`.

Parcours joués (`reports/audit/nutrition/scenarios/`, pellicule dans `reports/audit/nutrition/parcours/<nom>/`) :

| Parcours | Thème | Contenu |
|---|---|---|
| `1-carnet-ajout-suppression` | clair | ajout d'un aliment (quantité modifiée à 180 g), ajout d'une recette (1,5 portion), suppression + « Annuler », suppression définitive, rechargement |
| `2-carnet-jours-limites` | sombre | changement de jour, jour libre, recherche sans résultat, quantité vide / 0 / 99999, double tap sur valider, jour vide, date invalide dans l'URL |
| `3-menus-mange` | clair | cocher « mangé », vérifier le Carnet, décocher, double tap sur la coche, retirer + « Annuler », bascule entraînement |
| `4-menus-courses-copie` | clair | ajouter un repas à un créneau, « Envoyer aux Courses » deux fois, liste de courses, semaine suivante, copie de la semaine précédente |
| `5-recette-creer-modifier` | clair | recherche par ingrédient, création (nom vide, nom très long, double tap), modification du nom, étapes |
| `6-bilan-objectifs` | sombre | Bilan, objectifs (champ vide, nouvelle cible, rechargement), fiche recette au nom long |

Non testé : base réelle ; fonctions IA (saisie par chat, import de recette) ; notifications push (alerte kcal, rappel de saisie) ; gestes fins (balayage jour par jour du Carnet) ; hors-ligne réel ; pesée (saisie depuis Aujourd'hui, hors module) ; modification de la quantité d'un repas déjà saisi (le geste n'existe pas dans l'app : supprimer puis ressaisir, déjà noté A1 dans `reports/refonte-modules/nutrition.md`) ; bascule repos/entraînement depuis le Carnet (elle n'y existe pas : faite depuis Menus).

## 2. Problèmes

### Écritures vérifiées (faux Supabase, `/__writes`)

| Geste | Écritures observées | Verdict |
|---|---|---|
| Ajouter un aliment au Carnet (180 g) | 1 `POST journal_repas` (quantité 180) | conforme |
| Ajouter une recette (1,5 portion) | 1 `POST journal_repas` (quantité 1.5) | conforme |
| Supprimer + « Annuler » | aucune écriture | conforme |
| Supprimer (toast expiré) | `PATCH menus_repas` (délie un éventuel menu) puis `DELETE journal_repas` | conforme |
| Double tap sur « Ajouter » (Carnet) | 1 seul `POST journal_repas` | conforme, pas de doublon |
| Cocher « mangé » | `PATCH menus_repas {mange:true}` → `POST journal_repas` → `PATCH menus_repas {journal_repas_id}` | conforme |
| Décocher | `DELETE journal_repas` → `PATCH menus_repas {mange:false, journal_repas_id:null}` | conforme |
| Double tap sur la coche | validation puis annulation (5 écritures), état final « à manger », aucune entrée orpheline | conforme (le double tap se lit comme deux bascules) |
| Bascule entraînement | 1 upsert `jours_entrainement` | conforme |
| Ajouter un repas à un créneau | 1 `POST menus_repas` | conforme |
| « Envoyer aux Courses » (1er envoi) | 1 `POST courses_items` (lot) | conforme |
| « Envoyer aux Courses » (2e envoi) | **aucune écriture** | conforme, pas de doublon |
| Créer une recette, double tap | 1 seul `POST recettes` | conforme |
| Modifier une recette | 1 `PATCH recettes` | conforme |
| Objectif avec champ vide | aucune écriture | conforme |
| Objectif 2050 kcal | 1 upsert `objectifs_nutritionnels` | conforme |

### Bugs

À confirmer après examen des captures (voir « Suite »). Un seul point suspect à ce stade :

- **S1 (à vérifier) : changement de jour par taps rapprochés.** Parcours 2, étapes 2 à 5 : quatre taps sur « Jour précédent », mais l'ajout qui suit est écrit à la date J-1 (`2026-11-14`) et non J-4. Soit le parcours tape plus vite que la navigation (artefact du script, latence de 400 ms du mock), soit le lien garde l'ancienne cible pendant la transition. Non tranché.

### Échecs de parcours qui ne sont PAS des bugs de l'app

- Parcours 4, étape 17 (« Copier la semaine précédente » introuvable) : le seed place des repas sur J+1 à J+3, qui tombent dans la semaine suivante (aujourd'hui est un dimanche) ; la semaine cible n'est donc pas vide et l'app masque le bouton, comme prévu. À rejouer deux semaines plus loin.
- Parcours 5, étapes 19 à 25 (étapes de recette) : sélecteurs du parcours à corriger (le formulaire d'étape n'est pas ouvert par défaut, une expression de sélecteur est invalide). À rejouer.

### Artefacts du faux Supabase et du rig (pas des défauts de l'app)

- `GET /_vercel/speed-insights/script.js` → 404 à chaque chargement : script servi par Vercel uniquement.
- Requêtes `?_rsc=…` et `POST` d'action « net::ERR_ABORTED » : préchargements et actions interrompus par la navigation suivante du script.
- `POST jours_feries` au premier chargement : cache des jours fériés, vide dans le mock.
- `POST journal_repas` de la validation « mangé » contenant `id`, `mange`… : le mock renvoie la ligne entière au lieu d'appliquer le `select` du `PATCH` ; en base réelle seules `date, moment, aliment_id, recette_id, quantite` reviennent (`src/app/actions/menus.ts:66`).
- Les fonctions RPC renvoient `[]` dans le mock.

## 3. Propositions

À venir (après examen des captures). Les propositions P1 à P12 de `reports/refonte-modules/nutrition.md` (2026-11-14) restent la référence et ne sont pas rouvertes.

## 4. Critique impeccable

À venir.

## 5. Corrections

À venir. Aucun bug confirmé à ce stade, donc aucune PR ouverte.

## Suite prévue

1. Regarder les captures (repos clair/sombre, dernières étapes, étapes en échec), trancher S1.
2. Rejouer les parcours 4 (copie) et 5 (étapes) corrigés.
3. Critique impeccable, propositions, puis PR minimales si un bug réel est confirmé.
