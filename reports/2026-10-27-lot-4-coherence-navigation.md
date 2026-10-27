# Lot 4 de l'audit UI/UX : cohérence de la navigation — 2026-10-27

Suite de `reports/2026-10-26-audit-ui-ux-pro-max-complet.md` (constat Y1) et de `reports/2026-10-26-lots-1-2-etats-erreur-accessibilite.md`.

## Ce qui a changé

- **Onglets Pharmacie** (`pharmacie/OngletsPharmacie.tsx`) : ils utilisaient leur propre style (pastille blanche à l'état actif). Ils reprennent maintenant le contrôle segmenté « lien » de la sous-navigation Nutrition : `SEGMENT_CADRE`, `segmentClasseGlissant()` et `SegmentedPill` (actif en vert plein, `text-on-kcal`). `aria-current` et le nom accessible « Huiles essentielles » sont conservés. Règle DESIGN.md respectée : tout choix à 2-4 options passe par ce système.
- **Nouveau composant `components/BackLink.tsx`** : chevron SVG décoratif (`aria-hidden`) + nom de la destination, zone de tap étendue à 44 px par `linkButton`, transition de page directionnelle (`TransitionLink`), `self-start`. Le nom accessible est « Retour vers X » (`sansPrefixe` pour un libellé qui contient déjà l'idée de retour, ex. « Retour » du référentiel).
- **26 liens de retour remplacés** dans 24 fichiers, qui mélangeaient `‹ X` (17), `← X` (10) et des tournures « Retour aux … » : Collection, Objectifs, Vinted (annonce, réglages), Opinions, Recettes, Documents (fiche, étiquettes), Tâches (listes), Pharmacie (matière, chapitre, huile, révision, référentiel), Vider ma tête (feuille, calendrier), y compris les `loading.tsx` qui répliquent ces en-têtes. Libellés alignés sur la destination : « Retour aux tâches » devient « Tâches », « Retour aux documents » devient « Documents ».
- **e2e** : `e2e/detail-pages.spec.ts` cherche désormais le lien « Retour vers Collection » / « Retour vers Objectifs ».

## Défaut trouvé en route
Le premier jet du composant s'annonçait « Retour versCollection » (l'espace d'un texte masqué est perdu dans le nom accessible). Détecté par le nouveau test `BackLink.test.tsx`, corrigé avec un espace explicite.

## Non traité
- Les `‹ {axe.gauche}` des écrans Opinions sont des bornes de curseur, pas des retours : inchangés.
- Constat visuel en dehors du périmètre, vu sur la fiche Objectif à 375 px : le bouton « Ajouter » du champ « Nouvelle étape » dépasse du bord droit de la carte. À examiner au lot 5.
- Les lots 3 (largeur desktop) et 5 (polish) restent à faire.

## Vérification
`tsc --noEmit` et `eslint src` propres ; `vitest run` : 148 fichiers, 1768 tests passés (4 nouveaux : `BackLink` et `OngletsPharmacie`). Captures mobile clair et sombre des onglets Pharmacie et de six écrans de détail : liens uniformes, onglet actif en vert. Rig e2e : voir la PR.
