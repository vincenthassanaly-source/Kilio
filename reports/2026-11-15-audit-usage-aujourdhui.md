# Audit d'usage : Aujourd'hui (écran du jour, `/`)

Date : 2026-11-15. **Rapport partiel, poussé tôt** : seed, captures au repos et 8 parcours joués ; lecture des captures, critique impeccable et correctifs encore à faire (voir « Reste à faire »).

Banc : build de production sur `localhost:3101`, faux Supabase `localhost:54401` avec `MOCK_SUPABASE_SEED=audit` (données fictives de `e2e/seed-audit/aujourdhui.mjs`). Aucune base réelle, aucun appel Gemini.

## 1. Périmètre

- Route : `/` (`/aujourdhui` redirige). Captures au repos : `reports/audit/aujourdhui/ecrans/` (clair et sombre).
- Parcours joués (`reports/audit/aujourdhui/scenarios/`, pellicule dans `parcours/`) : 01 tour clair, 02 tour sombre, 03 tâches (cocher, annuler, double clic, décocher, planifier), 04 en retard (reporter, annuler, cocher), 05 habitudes, bouton haltère et pesée, 06 ajout rapide (FAB), 07 recherche globale et barre de saisie (phrase tapée, jamais validée), 08 événement de la frise et jour libre (sombre).
- Non testé : base réelle, Gemini (aperçu de saisie, « Valider »), notifications, hors-ligne réel, gestes tactiles fins (tirer pour rafraîchir, balayage), lancement réel d'une séance, bouton Réveil.

## 2. Problèmes

Relevé brut des parcours, à confirmer par la lecture des captures :

- **À vérifier (bug possible, faible)** : double clic sur une habitude (`parcours/05-habitudes-seances-pesee`, étape 6) : deux écritures identiques `valeur: 1` partent pour la même habitude au lieu d'une seule (ou d'un aller-retour). Écriture idempotente (upsert), donc sans dégât en base ; cause probable `src/app/(app)/DashboardHabitItem.tsx:74-82`.
- **À vérifier** : après un retour arrière depuis une feuille ouverte par le FAB (Note, Courses), le bouton « + » n'a pas pu être touché (étapes 20 et 23 de `parcours/06-fab-ajout-rapide`) alors que les entrées de l'éventail répondaient : l'éventail semble rester ouvert après le retour.
- Écritures attendues toutes présentes : cochage / décochage de tâche, report, planification, habitudes, jour d'entraînement, pesée, événement modifié / supprimé, jour libre.
- Aucun débordement horizontal relevé sur les 8 parcours.

### Artefacts du banc (pas des bugs)

- `GET /_vercel/speed-insights/script.js` en 404 : script servi seulement sur Vercel.
- Requêtes `?_rsc=` interrompues (`ERR_ABORTED`) : préchargements de liens annulés.
- Faux Supabase : le filtre `or=(and(…),and(…))` de `getEvenements` n'était pas compris (tous les événements revenaient, quelle que soit la date) ; corrigé dans `e2e/mock-supabase.mjs` (groupes `and(…)` et valeurs entre guillemets), sans quoi la frise affichait les événements d'autres jours.

## 3. Propositions

À venir.

## 4. Critique impeccable

À venir.

## 5. Corrections

À venir.

## Reste à faire

Lecture détaillée des captures, états vides, critique impeccable, propositions, PR éventuelles.
