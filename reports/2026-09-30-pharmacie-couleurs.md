# Pharmacie : couleurs de niveau dans les notions — 2026-09-30

Visualiser d'un coup d'œil des seuils (glycémie : bas / normal / à surveiller / danger) dans les notions et les cartes du module Pharmacie.

## Décisions
- Stockage inchangé : le champ texte `pharma_notions.contenu` (et `question` / `reponse` des cartes). Aucune migration de schéma.
- Syntaxe : `[couleur] texte` **en début de ligne**, couleurs `bleu | vert | orange | rouge | gris`. Lignes seulement (pas de segment inline en V1).
- Un contenu sans balise s'affiche exactement comme avant. Balise inconnue, `[vert]` seul ou au milieu d'une ligne = texte ordinaire.
- Sens des couleurs : bleu = bas (hypoglycémie), vert = normal / cible, orange = à surveiller (prédiabète), rouge = danger (diabète, hypoglycémie sévère), gris = repère / conversion / contexte.

## Accessibilité
La couleur n'est jamais seule : texte explicite conservé (« Normale », « Diabète »…), pictogramme de forme différente par niveau, libellé lu par les lecteurs d'écran (« Bas / Normal / À surveiller / Danger / Repère : »). Le texte reste en encre normale ; seules la barre latérale, le fond teinté (12 %) et le pictogramme portent la couleur (jetons du thème, variantes clair et sombre).

## Fichiers
- `src/lib/pharmacie/contenu.ts` (+ test) : parseur, `enTexteBrut`, `appliquerNiveau` (insertion sur la ligne du curseur ou la sélection).
- `src/app/(app)/pharmacie/ContenuColore.tsx` (+ test) : rendu, utilisé sur la page chapitre, la révision (question et réponse) et l'aperçu de l'éditeur ; extraits de recherche et recherche locale en texte brut.
- `NotionEditeur.tsx` : barre de boutons de couleur (cibles 44 px), « Sans couleur », aperçu en direct.
- `scripts/migration-pharmacie-couleurs-2026-09-30.sql` (+ `-revert.sql`) : coloration des 6 notions de « Glycémie et diabète », texte médical inchangé (vérifié mot pour mot), gardée par `and contenu = <original>`. **Appliqué en base le 2026-09-30** (6 notions), ainsi que `scripts/migration-pharmacie-couleurs-cartes-2026-09-30.sql` (+ `-revert.sql`) pour les 11 cartes associées (réponses colorées, texte inchangé ; les « ; » de la carte HbA1c deviennent des retours à la ligne).

## À reporter dans DESIGN.md (via `impeccable document`)
Exception assumée : les couleurs de niveau (bleu `--accent-agenda`, vert `--accent-kcal`, orange `--accent-warning`, rouge `--accent-alert`, gris `--ink-3`) sont des indicateurs passifs dans le contenu des notions Pharmacie (barre + fond teinté + pictogramme), jamais des contrôles ; l'interaction reste en vert Kcal.

## Skill
`kilio-pharmacie-ajout` vit dans le dépôt KilaSkills : la section « Couleurs des seuils » y est à ajouter (voir le prompt fourni dans la conversation).
