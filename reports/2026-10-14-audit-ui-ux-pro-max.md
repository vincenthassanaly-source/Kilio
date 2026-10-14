# Audit UI/UX (ui-ux-pro-max) — 2026-10-14

Périmètre : mobile 390 px, thèmes clair et sombre ; priorité aux écrans Accueil, Aujourd'hui,
Inbox, Plus, Réglages, Nutrition, Courses, Tâches, Agenda (+ habitudes, notes, menus, recettes,
bilan, objectifs, revue). Méthode : build de production avec le faux Supabase du rig e2e,
axe-core (WCAG 2.0 à 2.2 A/AA + bonnes pratiques), mesure des zones tactiles par sondage
`elementFromPoint` (prend en compte les pseudo-éléments `after:`), débordement horizontal,
police < 12 px, captures. Constats déjà couverts par `reports/2026-10-10-audit-perf-accessibilite.md`
non répétés. Correctifs « sûrs » uniquement ; identité visuelle conservée.

## Corrigé
- **Contraste du vert de marque (thème clair).** `--accent-kcal` et son fond doux passent de
  `oklch(0.55 0.14 165)` à `oklch(0.495 0.14 165)` (≈ `#00794d`). Avant : 12+ éléments sous 4,5:1
  (texte blanc sur vert 4,38 ; vert sur ivoire 4,0 à 4,3 ; vert sur vert doux 3,68). Après : 0
  violation `color-contrast` dans les deux thèmes sur les 17 écrans audités. Teinte légèrement
  plus profonde, à valider à l'œil ; `DESIGN.md` mis à jour.
- **Bilan nutrition** : libellés `dt` de la synthèse en `text-ink-2` (4,17:1 clair, 4,46:1 sombre → conformes).
- **Zones tactiles** (visuel inchangé, pseudo-élément `after:`) : sélecteur Jour/Semaine/Mois/Liste de
  l'agenda (36 → 44 px), pastilles de filtre de priorité des tâches (36 → 44 px), lien « Gérer les listes ».
- **Écran d'erreur** : le titre est un `<h1>` (la page remplacée n'avait plus aucun titre de niveau 1).

## Non traité / à décider
- Cases « Marquer fait » du tableau de bord et de Tâches : zone effective ≈ 30 px (hitSlop volontairement
  réduit pour éviter le chevauchement de coches empilées, cf. `CheckToggle`). Un vrai gain demande
  d'espacer les lignes : changement de mise en page, hors du périmètre « sûr ».
- Boutons compacts « Modifier / Suppr. » (≈ 34 px mesurés, zone étendue en théorie à 44) et cellules du
  calendrier du bilan (41 px) : proches du seuil, à revérifier sur appareil réel.
- `/reglages` s'affiche en erreur avec le faux Supabase du rig (donnée manquante) : écran non audité visuellement.
- Aucun débordement horizontal, aucune police < 12 px hors pastilles de 11 px déjà documentées.
