# Tâches — critique impeccable et corrections P1/P2 — 2026-11-10

## Constats

- Captures des 2 écrans (`/taches`, `/taches/listes`) et de 18 états (mobile et desktop, clair et sombre) sur le faux Supabase (`e2e/mock-supabase.mjs`), données ajoutées par son API REST, jamais dans la base réelle. Captures non commitées (`reports/ecrans/`).
- Critique (évaluation A design + évaluation B détecteur/navigateur, sous-agents isolés) : 28/40 ; détecteur : 0 résultat ; problèmes trouvés par revue et mesures navigateur.
- Le rapport `2026-08-31-taches-vue-defaut-toutes.md` est périmé : la vue par défaut est « Aujourd'hui » (`TachesView.tsx`, useState("aujourdhui")) depuis #297. Le retard n'apparaît pas dans « Aujourd'hui », seul le compteur de l'onglet « En retard » le signale : décision produit à confirmer, non modifiée ici.
- `capturer-ecrans.mjs` plante au premier lancement (`browserType.launch: Executable doesn't exist at .../chromium_headless_shell-1194`) : le Playwright du dépôt attend une version de Chromium absente du sandbox. Contournement : `executablePath`.

## Corrections appliquées

- P1 : le résumé « Filtres et tri · … » ne déborde plus sous « Listes » (bouton `flex-1`, span `block truncate`).
- Retard : date en `text-alert` (elle était écrasée par `metaText`).
- Zones de tap : titre de tâche 44 px, pastille « + sous-tâches » 44 px ; pastille masquée sur une tâche terminée sans sous-tâche.
- Sélection : un seul « Fermer » (en-tête), actions masquées à 0 sélection, barre bornée à la colonne (`max-w-2xl`).
- Archives : chevron, plus de carte parente.
- « 7 jours » : tri par échéance d'office en ordre manuel, séparateurs de jour.
- Chips de liste : retour à la ligne, pastille grise pour une liste sans couleur, aucune pour « Toutes ».
- Segmenté : `min-w-0` sur les segments (local à Tâches).
- États vides : bouton « Ajouter une tâche » (déclenche le « + » flottant), « N en retard : les voir » sous « Rien de prévu aujourd'hui ».
- Feuille « Nouvelle tâche » : raccourcis Aujourd'hui / Demain / Ce week-end / Lundi, liste en chips (plus de `<select>`), « Créer » pleine largeur.
- Listes : couleurs par pastilles prédéfinies + « Aucune » (plus de bleu imposé), ligne compacte, « Supprimer la liste » dans le mode édition ; tags : édition (nouvelle action `updateTag`) et libellé « Supprimer ».

## Non traité (P3 et décisions)

Vue par défaut et place du retard, en-tête de `/taches/listes`, squelette `loading.tsx`, apostrophes, « Tout sélectionner » (actives seulement), priorité à la fois filtre et tri, cartes sans trait signature Kilio.

## Vérifications

`npx tsc --noEmit` : 0 erreur. `npx eslint` (module + actions) : 0 erreur. `npx vitest run` : 2395 tests passés. `npx next build` : réussi. Captures « après » vérifiées visuellement (mobile clair) : filtres actifs, 7 jours, en retard, sélection, archives, feuille Nouvelle tâche, édition de liste.
