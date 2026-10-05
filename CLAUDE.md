@AGENTS.md

## Workflow Git

À la fin de chaque session de modifications (une fois les changements terminés et vérifiés), fusionne toi-même la pull request vers `kiliomain` (la branche par défaut de ce dépôt, par exemple avec `gh pr merge --squash --delete-branch`), sans attendre de confirmation supplémentaire. L'objectif est que le travail soit visible en ligne et déployé immédiatement à la fin de la session, sans étape manuelle de ma part. Si des vérifications (build, tests, lint) sont disponibles, assure-toi qu'elles passent avant de fusionner.

## Notification push

Envoie une notification push (outil `PushNotification`, une phrase courte) **uniquement** dans ces deux cas :

1. Une pull request vient d'être fusionnée vers la branche par défaut : les modifications sont maintenant accessibles en ligne. Envoie-la juste après la fusion.
2. Tu ne peux pas fusionner et as besoin de moi (CI en échec, conflit, question qui bloque) : dis-moi ce qui bloque.

N'envoie aucune autre notification : pas de notification à chaque réponse, ni pour une simple question, une réponse ou une session sans fusion.
