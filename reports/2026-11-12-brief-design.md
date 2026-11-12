# Brief de direction de design — audit UI/UX par module (2026-11-12)

Périmètre : Nutrition, Courses, Musculation, Scanner, Documents, Pharmacie, Collection, Habitudes, Objectifs, Journal, Notes. Tâches, Agenda et Aujourd'hui sont exclus (audités dans les commits #293 à #307). Point de départ : `reports/2026-11-07-audit-global.md`. Tout constat déjà listé dans ce rapport est cité, pas refait.

Sources : `PRODUCT.md`, `DESIGN.md`, `GLOSSARY.md`, code des modules.

## Les 5 axes

1. **Purpose.** Kilio est le « système d'exploitation personnel » de Vincent : un écran doit permettre de consulter ou de saisir en quelques secondes, souvent d'une main, sans quitter le flux. La saisie d'un repas, la coche d'une course ou d'une habitude, le lancement d'une série et la prise d'une photo de document sont les gestes quotidiens ; le reste (réglages, réorganisation, historique) est occasionnel.
2. **Audience.** Un seul utilisateur, expert de son app, usage quotidien sur téléphone (PWA, S Pen pour le Journal), parfois hors ligne. Pas de découverte ni d'onboarding à soigner : la mémoire musculaire prime sur la pédagogie. Le desktop est secondaire.
3. **Tone.** « Tableau de bord doux » : dense et utilitaire, calme, neutre. Jamais de jugement ni de vocabulaire de retard ou d'échec (voir le score du jour et la nutrition). Animations discrètes, respect de `prefers-reduced-motion`.
4. **Memorable detail.** Un seul endroit où investir : le geste le plus fréquent de chaque module (coche, ajout rapide, démarrage de séance, prise de photo). Il doit être irréprochable en zone tactile, retour visuel, annulation et comportement hors ligne. Le reste reste discret.
5. **Constraints.** Respecter les tokens de `DESIGN.md` (couleurs oklch, rayons 12 à 24 px, Sora/Inter, couleur par module) et les composants existants (`Modal`, `ConfirmDialog`, `SegmentedControl`, `Switch`, `CheckToggle`, `ErrorState`, toasts, `BottomNav`). Pas de nouveau composant si un existant convient. Dexie et la file hors ligne ne doivent pas être contournés. Le Journal reste verrouillé par passkey et ses écrans d'écriture masquent la barre du bas.

## Règle de recevabilité d'un constat

Chaque constat cite le fichier et la ligne, le scénario, l'axe violé (Purpose, Audience, Tone, Memorable detail ou Constraints), et si le correctif est sûr (sans changement de comportement ni de schéma). Un constat qui ne viole aucun axe n'est pas retenu. Les changements structurants (navigation, éléments épinglés, réorganisation) sont signalés comme options séparées, jamais appliqués.

## Grille d'audit (trois passes par module, lecture seule)

1. **Conformité et accessibilité** : Web Interface Guidelines, WCAG 2.2 (cibles ≥ 24/44 px, contrastes, noms accessibles, focus, `aria-*`, mouvement réduit).
2. **Parcours** : pour chaque bouton, la chaîne complète clic → état → rendu (état final incohérent, actions qui s'annulent, optimisme sans rollback, hors ligne).
3. **Finitions** : rayons concentriques, alignement optique, `text-wrap`, `tabular-nums`, transitions explicites, zones de clic.
