# Aujourd'hui : corrections issues de l'audit

Source : `reports/audit/aujourdhui/` (écrans au repos, 7 parcours, critique impeccable).

## Corrigé

1. **Saisie naturelle** : le message d'erreur n'expose plus le fournisseur ni la clé absente ; le détail part dans les logs serveur (`saisie.ts`).
2. **FAB** : voile derrière l'éventail ouvert (`QuickAddFab.tsx`), toast relevé au-dessus du « + » (`ToastHost.tsx`).
3. **Doublon « Ajouter »** : le bouton d'ajout de tâche s'appelle « Ajouter la tâche » (`AjoutRapideTache.tsx`).
4. **Frise** : repliée en bandeau « Plus rien de prévu aujourd'hui » quand il ne reste rien à venir, dépliable via « Voir la frise » (`DayTimeline.tsx`, grille extraite dans `GrilleJournee`).
5. **Clôture des tâches** : une fois tout coché, la ligne de succès est en accent et les tâches faites restent dépliées (`TachesDuJour.tsx`).
6. **Libellés** : le déclencheur de report dit « Choisir une date de report pour … », l'icône décorative n'a plus de `title` (`EnRetardSection.tsx`).

## Tests

- e2e : `e2e/aujourdhui.spec.ts` (frise repliée le soir, noms de boutons distincts) ; le test d'ajout d'événement fige l'horloge le matin.
- Unitaires : `AjoutRapideTache.test.tsx`, `EnRetardSection.test.tsx` mis à jour.

## Non traité (jugement de design, à décider)

Fusion des trois entrées de création, ton des états vides, forme unique de l'action en haut de carte, titre « Journée » hors carte.
