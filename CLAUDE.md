@AGENTS.md

## Workflow Git

À la fin de chaque session de modifications (une fois les changements terminés et vérifiés), fusionne toi-même la pull request vers `kilio` (la branche par défaut de ce dépôt, par exemple avec `gh pr merge --squash --delete-branch`), sans attendre de confirmation supplémentaire. L'objectif est que le travail soit visible en ligne et déployé immédiatement à la fin de la session, sans étape manuelle de ma part. Si des vérifications (build, tests, lint) sont disponibles, assure-toi qu'elles passent avant de fusionner.
