# Raccourci d'icône « Ajouter une tâche » : ouverture fiable et fermeture après création

## Problème
- L'appui long sur l'icône → « Ajouter une tâche » arrivait sur `/taches` sans ouvrir le formulaire.
- Un formulaire de création était resté ouvert et rempli après l'ajout de la tâche.

## Changements (`src/app/(app)/QuickAddFab.tsx`)
- Le paramètre de raccourci (`?action=new`, `?ajout=evenement`) n'était lu qu'au montage. Il est désormais aussi relu à `pageshow` et au retour au premier plan (`visibilitychange`), pour le cas où l'app est déjà ouverte en arrière-plan. Le paramètre est retiré de l'URL dès qu'il est consommé, donc une relecture sans raccourci ne fait rien.
- Mode direct (`/taches`) : après la création, le formulaire est fermé explicitement (`setMode(null)`) au lieu de dépendre d'un `history.back()`. `useBackClose` retire lui-même l'entrée d'historique.
- Le raccourci Note passe par `?action=new` lu côté serveur (`notes/page.tsx`) : pas de défaut équivalent, inchangé.

## Tests
`QuickAddFab.raccourcis.test.tsx` : app déjà montée + raccourci reçu au retour au premier plan ; fermeture du formulaire après création en mode direct.

## À savoir
- Android met le manifest en cache : si le raccourci pointe encore vers l'ancienne URL (`/taches` sans paramètre, avant la PR #132), il faut désinstaller puis réinstaller la PWA.
- Le cas du formulaire inline de la carte « + Ajouter une tâche » resté ouvert n'a pas été reproduit par lecture du code (`AddTaskToggle` ferme explicitement via `setOpen(false)`). À surveiller après déploiement.
