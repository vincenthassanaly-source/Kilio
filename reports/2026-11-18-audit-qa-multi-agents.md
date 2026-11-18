# Audit QA multi-agents — 2026-11-18

Deux passes d'agents en parallèle (UI par groupes de modules, performance et accessibilité, revue de code, audit des modules, vérification, logique métier, robustesse hors ligne, balayage d'écrans) sur un build de production local branché sur le faux Supabase (`e2e/mock-supabase.mjs`). Aucun code applicatif n'a été modifié.

Les constats de sécurité ne figurent volontairement pas ici (dépôt public) : ils sont traités à part.

## Limites de la méthode

- Le faux Supabase ne gère pas les jointures `!inner`, l'envoi vers Storage ni les embeds PostgREST : les statistiques de musculation, l'envoi de documents et le module Partis n'ont pas été vérifiés en interface (les calculs de musculation l'ont été par exécution de scripts).
- Hors ligne : seules la coche de tâche, le rejeu de file et les doubles soumissions ont été testés en interface ; notes, habitudes, musculation et nutrition hors ligne ne sont revus qu'au code.
- Non couverts : copie IndexedDB et calendrier du Journal.
- Erreur d'hydratation React #418 : vue pendant les tests puis **non reproduite** (0 erreur sur 60 chargements) ; artefact probable du mock, non retenue.

## Priorité haute

1. **Séance de musculation ouverte plus de 24 h : impossible à enregistrer.** « Durée de séance invalide. » au « Terminer », la séance reste bloquée dans IndexedDB, le toast revient à chaque retour au premier plan, aucun écran pour la voir ou la supprimer. `seance.ts:505` et `:538`, `finir()` dans `SeanceView.tsx`, `MusculationSync.tsx:41`. Démontré par script.
2. **Hors ligne, toute navigation affiche le tableau de bord sous la mauvaise URL** (repli `caches.match("/")`, `public/sw.js:213-218`) avec erreur d'hydratation ; le cache n'a ni éviction ni test de statut.
3. **Un 500 sur `createTache` fait tomber la page sur l'écran d'erreur et perd la saisie** (`AddTaskForm.tsx`).
4. **`/plus` : tuiles annoncées « bouton, triable » et deux arrêts de tabulation par tuile** (attributs dnd-kit sur le `<a>`, `whileTap` qui ajoute `tabindex=0`, `ModulesGrid.tsx:52-84`).

## Priorité moyenne

**Données et logique**
- Série d'une habitude quotidienne remise à 0 chaque matin tant que la case n'est pas cochée.
- Création de note : erreur renvoyée alors que la note est écrite, doublon au réessai.
- Suppression dans le Storage avant la ligne en base : une panne laisse des lignes vers des fichiers disparus.
- Macros et cibles recalculées à la volée : modifier un aliment, une recette ou une cible réécrit l'historique et le Bilan.
- Supprimer une séance remet le jour en repos malgré une bascule manuelle ; « Envoyer aux Courses » écrit partiellement et double les quantités.
- Rappels de tâches marqués « envoyés » même si l'envoi échoue ou sans abonnement ; actions abandonnées par la file offline : un simple toast.
- Deux onglets rejouent la file offline en double (rejeu exécuté deux fois), sans verrou.
- « Précédent » absent quand un autre exercice est très fréquent (limite partagée dans `dernieresSeries`) ; aucune courbe de progression pour les exercices au poids du corps ou cardio.

**Messages d'erreur**
- 58 `fail(error.message)` affichent des messages Postgres bruts.
- Fiche recette : quantité 0/négative/vide, ingrédient libre sans nom, étape sans consigne → « Minified React error #441 » (HTTP 500). `recette-ingredients.ts:49`, `recette-ingredients-libres.ts:57`, `recette-etapes.ts:61`, `IngredientManager.tsx:81`, `IngredientsLibresManager.tsx:79`, `EtapesManager.tsx:87`.
- Collection : lien vidéo invalide → même erreur #441 (`AddPhotoButton.tsx:151`).

**Interface**
- Barre du bas : épingler un module déjà épinglé crée un doublon persisté, qui « change » au rechargement (`NavigationEditContext.tsx` ; `updateModulesBarreBasse` ne valide pas l'unicité).
- Recherche globale : après Échap, la liste ne se rouvre plus en continuant de taper (`GlobalSearchBar.tsx`).
- Notes : le bouton « Ajouter » d'un item de checklist sort de l'écran sous 376 px (`NoteForm.tsx:226-241`, `min-w-0` manquant).
- Habitudes : un nom long sans espace déborde (`HabitudeCard.tsx:210-214`) ; aucun `maxLength`.
- Pharmacie : le sommaire d'un chapitre ne défile pas jusqu'à la notion (`page.tsx:69-75`, `useBackClose`) ; impossible d'enregistrer les « Particularités » d'une molécule sans indications (`MoleculeEditeur.tsx:51`) ; huiles : un décalage de 50 px au blur d'un tag fait rater le tap suivant (`TagsInput.tsx:89`).
- Texte agrandi (balayage 1230 pages) : à 200 % la barre du bas est rognée aux deux extrémités ; barre d'outils du Journal (« Transcrire ») hors écran dès 130 % ; en-têtes du Carnet et des fiches recette rognés à 200 %.

**Performance, PWA, accessibilité**
- 4 Server Actions de lecture sérialisées (~1,7 s) sur `/`, requêtes du planning de travail en double sur `/agenda`.
- 32 requêtes RSC (~215 Ko) par chargement ; ~420 Ko brotli de JS identiques sur chaque route (framer-motion complet, chunk Scanner partout).
- `whileTap` rend aussi focusable le `li` de `/collection`.
- Icônes maskable hors zone de sécurité ; 6,6 Mo d'animations retéléchargés à chaque nouveau `sw.js`.
- `viewport-fit=cover` absent alors que le code utilise `env(safe-area-inset-*)`.

## Priorité basse

- Carnet : `?date=2026-13-45` ou `0000-00-00` → page d'erreur générique (`jour.ts:20`) ; `2026-02-30` bascule silencieusement au 2 mars ; lien « jour suivant » mal formé à `9999-12-31`.
- Affichage : point décimal au lieu de la virgule (`vue-repas.ts:50`, `RecetteMacros.tsx:26`) ; casse « 18 Novembre », « Semaine Du » (classe `capitalize`) ; « 0 kcal/portion » sur recette vide ; écart 653/652 kcal ; bouton « Ajouter un repas » en double sur un jour vide.
- Saisie : habitude quantifiée à valeur négative ignorée sans retour et sans borne haute ; noms de listes en double acceptés ; renommage d'un article de Courses sans limite ni contrôle de doublon ; portions non plafonnées ; objectif kcal = 0 accepté ; objectif d'entraînement non effaçable ; dates de séance absurdes acceptées (années < 100 → 19xx) ; séance de moins de 30 s non modifiable ; `lireNombre` accepte `0x10`, `1e3`, `0b11` ; 1RM d'une répétition supérieur à la charge.
- Navigation : `/musculation/routines/<id non-UUID>` ouvre « Nouvelle routine » ; Échap ne ferme pas le menu du bouton « + » ; retour système avec confirmation ouverte quitte la séance ; onglets Opinions hors historique ; modifications d'une idée perdues sans avertissement.
- Libellés : « Bilan » encore dans `registry.ts:264` ; « Valider » dans `ApercuSaisie` (charte des verbes) ; textes visible et `aria-label` différents sur les segments de type d'habitude ; compteur « Voir N tâches » incluant les tâches terminées repliées.
- Silencieux : rollbacks et lectures sans contrôle de `error` (`menus.ts`, `serveur.ts`) ; `catch` vides dont `getJoursFeries(...).catch(() => [])` ; abandon silencieux des retentes de `rappelRepos` ; report de rappel en 24 h fixes et `paris.ts:39` faux aux deux dimanches de changement d'heure.
- Divers : zones tactiles < 44 px (coches du tableau de bord 30×30) ; contraste 4,45:1 sur le numéro de jour du Bilan ; CLS 0,065–0,067 sur Musculation ; manifeste (orientation verrouillée, pas d'`id`) ; archivage d'habitude irréversible ; calcul de semaine dupliqué 8 fois ; types et documentation périmés après retraits de modules ; script `migration-taches-programme-jour-2026-09-13.sql` cité mais jamais commité (la fonctionnalité est bien implémentée en base).
- Tests : aucun test sur `menus.ts`, `musculation.ts`, `seances.ts`, les routes API de rappels, `lib/push/subscribe.ts` ni les Edge Functions. Vérifications : `tsc` 0 erreur, `eslint` 0, `vitest` 2552/2552, `knip` 1 export inutilisé.

## Sans anomalie (vérifié)

`lang=fr`, zoom non bloqué, un seul `h1` par route, aucun nom accessible manquant, modales (piège de focus, Échap, retour du focus), `prefers-reduced-motion`, aucun débordement horizontal sur 41 routes × 30 configurations, formats fr-FR/en-US identiques, calculs de dates aux changements d'heure, macros, verdicts, jours libres, verrou passkey, doubles clics idempotents, désabonnement push sur 404/410. Budget, Objectifs et Vinted sont bien retirés du code.

## Perspectives d'amélioration

Fortes : figer les macros et historiser les objectifs ; Courses « intelligentes » depuis Menus (additionner, soustraire le placard, aperçu) ; série d'habitude tolérante avec « Désarchiver » ; rapprochement Storage/tables.
Moyennes : exception d'occurrence sur événements récurrents ; révision Pharmacie visible dans Aujourd'hui ; « semaine type » dans Menus ; écran « Santé des données » dans Réglages ; trajectoire poids / tour de taille dans le Bilan ; recherche globale étendue.
Faibles : tests e2e pour les promesses des rapports récents ; test de charte des libellés.
