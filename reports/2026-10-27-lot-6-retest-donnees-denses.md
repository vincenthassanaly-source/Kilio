# Lot 6 de l'audit UI/UX : re-test avec des écrans remplis — 2026-10-27

Suite de `reports/2026-10-26-audit-ui-ux-pro-max-complet.md`, après les lots 2, 1, 4 et 5.

## Méthode

- **Données** : pas de clés Supabase de production ici, et les données personnelles (journal intime, santé) n'ont pas à entrer dans une session d'audit. Le faux Supabase du rig (`e2e/mock-supabase.mjs`) a été copié dans le scratchpad et rempli d'un **jeu synthétique dense** : 28 tâches (titres de 90 caractères, sous-tâches, 4 listes, 4 étiquettes dont une très longue), 7 événements qui se chevauchent, 6 habitudes avec séries, 26 articles de courses, 8 notes (texte et checklists, 8 couleurs), 4 objectifs, 6 idées, 5 annonces Vinted, 6 documents, 6 recettes, 17 repas dans le journal. Le jeu n'est pas versionné ; les données réelles de Vincent n'ont **pas** été testées.
- **Passages** : les 52 routes (identifiants réels du jeu pour les pages de détail) en mobile 375 px clair, sombre et **texte agrandi (zoom 150 %)**, avec axe-core (WCAG 2.0 à 2.2 AA + bonnes pratiques), mesure des débordements et des `h1`.
- **Piège de méthode confirmé** : ouvrir l'app en dev par `localhost`, pas `127.0.0.1` ; le serveur de dev Turbopack peut aussi planter en cours de campagne (panique interne), il faut alors le relancer.

## Ce que le jeu dense a révélé (et que les écrans vides cachaient)

1. **Contraste insuffisant sur surfaces teintées** (thème clair, 5 écrans) : `ink-3` fait 4,17:1 sur `surface-alt` (pastilles d'étiquettes, tuiles de macros, heure de la revue, chips de statut) alors que `DESIGN.md` ne le garantissait que sur `surface`. Idem pour le rouge d'alerte sur une note verte (4,39:1), les teintes de macro sur `surface-alt` (3,57 à 4,18:1) et le texte des étiquettes colorées par l'utilisateur (3,45 à 3,53:1).
2. **Même défaut en thème sombre** : `ink-3` 4,46:1 sur `surface-alt`, alerte 4,35:1 sur une note sombre.
3. **Noms accessibles manquants** : le champ de valeur d'une habitude chiffrée (« 1500 ») et le sélecteur d'ingrédient d'une fiche recette n'avaient ni label ni nom.
4. **Rangée de pastilles « Reporter »** (`aujourdhui/EnRetardSection.tsx`) : ne passait pas à la ligne, donc coupée à 150 % de zoom.

## Corrections

- Tokens (`globals.css`, `DESIGN.md` mis à jour) : clair `ink-3` 0,54 → 0,52, `accent-alert` 0,55 → 0,52, `accent-protein` 0,55 → 0,52, `accent-carbs` 0,58 → 0,52, `accent-fat` 0,56 → 0,53 ; sombre `ink-3` 0,64 → 0,66, `accent-alert` 0,70 → 0,74. Chaque valeur est calculée pour atteindre 4,5:1 sur `surface-alt`, et le rouge d'alerte sur les teintes de notes.
- Notes (`NoteCard`, `NoteForm`) : texte secondaire (éléments cochés, « Note vide », « Fermer ») en `ink-2`, `ink-3` n'atteignant pas 4,5:1 sur les teintes de note.
- Étiquettes colorées (`TasksList.couleurStyle`) : le texte est mélangé à 45 % d'`--ink` pour rester lisible quelle que soit la couleur choisie.
- `aria-label` : « Valeur de {habitude} » (`HabitudeCard`) et « Ingrédient » (`IngredientManager`).
- `EnRetardSection` : `flex-wrap` sur la rangée de pastilles.

## Résultat du re-test
Après correctifs : **0 violation axe** en mobile clair texte agrandi (52 pages) ; contraste sombre propre sur les quatre écrans concernés ; 0 débordement horizontal et 0 page sans `h1` sur les 52 routes avec identifiants réels. `tsc`, `eslint` et 1776 tests unitaires passent.

## Limites et suite
- Écran Réglages, Documents et Vinted : en erreur dans cette campagne parce que le jeu dense ne simule pas leurs tables liées (`document_fichiers`, `vinted_photos`, colonnes d'alertes) : ce sont des lacunes du faux Supabase, pas de l'app. Ces écrans restent à vérifier sur une base réelle.
- Non testés : données réelles de Vincent, geste par geste (drag, swipe, pinch), clavier virtuel, VoiceOver/TalkBack, Vider ma tête (passkey).
- Reste à faire : lot 3 (largeur desktop). Tous les autres lots du plan sont faits.
