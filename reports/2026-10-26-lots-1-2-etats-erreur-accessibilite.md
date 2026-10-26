# Lots 2 et 1 de l'audit UI/UX : accessibilité rapide, puis états d'erreur — 2026-10-26

Suite de `reports/2026-10-26-audit-ui-ux-pro-max-complet.md`. Lot 2 d'abord (risque très faible), lot 1 ensuite.

## Lot 2 — accessibilité rapide

- **Écran de partage** (`app/collection/partage/choisir/page.tsx`) : la racine devient `<main>` (le `h1` existait déjà ; seul le landmark manquait).
- **Zones défilantes** : `agenda/DayView.tsx` et `aujourdhui/DayTimeline.tsx` reçoivent `tabIndex={0}`, `role="region"`, `aria-label="Grille horaire du jour"` et un anneau de focus `focus-visible`. Le défilement de la journée est atteignable au clavier.
- **Barre du bas** : `<nav aria-label="Navigation principale">` (les deux autres `<nav>` du projet étaient déjà nommés).
- **Titres de niveau 1 sur les états « introuvable »** :
  - `app/not-found.tsx` : le titre « Page introuvable » devient un `<h1>` (c'était un `<p>`) ; couvre les `notFound()` des fiches Documents et Recettes.
  - Pharmacie : `IntrouvableCarte` accepte un `titre` (rendu en `h1`), passé par les six pages de détail (matière, chapitre, huile, classe, pathologie, médicament).
  - Musculation : séance introuvable (`EntrainementDetailView`, `EditionEntrainement`) et exercice introuvable (`FicheExercice`) passent par `ErrorInline` avec `titre`.
  - Collection, Objectifs, Vinted (annonce), Opinions (idée) : même traitement, voir lot 1.

## Lot 1 — états d'erreur

- **Nouveau composant `components/ErrorInline.tsx`** : message, bouton « Réessayer » quand un `retry` est fourni, `role="alert"` systématique, `h1` optionnel (`titre`) pour les pages de détail. Variante `ErrorInlineRefresh` pour les Server Components (le bouton relance le rendu serveur via `router.refresh()`).
- **Écrans de liste branchés sur `refetch`** : Courses, Tâches, Habitudes, Notes, Objectifs, Collection, Vinted (liste), Opinions (idées et partis), Historique et Statistiques de musculation, Routines, Sélecteur d'exercices, Réglages Vinted, Pharmacie (cours, référentiel, huiles).
- **Pages de détail** (Collection, Objectifs, Vinted, Opinions, séance, exercice) : distinguent « Chargement impossible » (avec « Réessayer ») de « … introuvable » (sans bouton), chacun avec son `h1`.
- **Messages techniques supprimés** : `nutrition/recettes/page.tsx` et `nutrition/menus/MenusSemaine.tsx` n'affichent plus `error.message` (loggé en console) ; l'erreur de Recettes garde le titre et la sous-navigation Nutrition. Bilan (`BilanContenu`, `BilanSante`) gagne aussi le bouton.
- **Voix** : `ErrorState` et `global-error.tsx` passent du vouvoiement au tutoiement, comme tous les autres messages.
- **Texte des messages** : « Erreur de chargement de X. Réessaie. » devient « Impossible de charger X. » + bouton ; « Réessaie une fois en ligne » (Pharmacie) devient « Vérifie ta connexion », comme Musculation.

## Non traité

- L'Agenda avait déjà son bouton (inchangé). Les erreurs d'actions (toasts « … Réessaie. ») restent des toasts : ce ne sont pas des états de chargement.
- `reglages/AlertesNutritionRow.tsx:38` (crash si `rappel_saisie_heure` est absent) : lot 5.
- Les lots 3 (largeur desktop), 4 (cohérence navigation) et 5 (polish) restent à faire.

## Vérification

`tsc --noEmit` propre, `eslint src` sans avertissement, `vitest run` : 147 fichiers, 1764 tests passés (dont 4 nouveaux pour `ErrorInline` ; le test des Tâches vérifie désormais le bouton « Réessayer »). Rig e2e (`npm run test:instant`) : voir la PR.
