# Documents — bouton « Réorganiser » (Gemini)

## Contexte

Les catégories de documents sont libres (le tri du vrac en crée au fil de l'eau),
donc elles se multiplient et se recoupent. Vincent voulait un bouton qui demande
à Gemini de revoir **tout** le classement et de proposer une réorganisation,
qu'il valide avant qu'elle soit appliquée. Cadrage issu d'un entretien.

## Décisions

- **Objectif** : refonte des catégories (fusions, renommages, créations, documents
  déplacés). Les **noms** des documents ne bougent pas.
- **Source** : métadonnées seulement (nom, catégorie, notes) en **un seul appel**
  Gemini ; les fichiers ne sont pas relus (rapide, pas de quota).
- **Périmètre** : documents **classés** uniquement ; le vrac garde son propre tri.
  Un document en vrac compte pourtant dans l'effectif de sa catégorie (elle n'est
  donc pas supprimée « parce qu'elle est vide »).
- **Validation** : liste de changements groupés (« Autre → Travail », n docs),
  chaque groupe et chaque document décochable, destination modifiable. Rien n'est
  écrit avant « Appliquer ».
- **Catégories vidées** : supprimées automatiquement, via une case cochée par
  défaut qui nomme les catégories concernées (décochable).
- **Instruction facultative** avant le lancement (ex. « pas plus de 8
  catégories »), plafonnée à 300 caractères et présentée à Gemini comme une
  simple préférence de classement.
- **Annulation** : message « Annuler » après l'application ; il remet chaque
  document dans son ancienne catégorie, recrée les catégories supprimées et
  retire celles que la réorganisation avait créées si elles sont vides.
- **Emplacement** : bouton « Réorganiser » en haut de `/documents`, visible dans
  tous les onglets, dès que deux documents sont classés.

## Fichiers

- `src/lib/documents/reorganisation.ts` — consigne, schéma de réponse, lecture
  défensive (numéros inconnus ou répétés ignorés, catégorie reconnue malgré
  casse/accents, nouvelles catégories de même sens unifiées, seuls les documents
  qui changent sont rendus), regroupement, calcul des catégories vidées.
- `src/app/actions/documents-reorganisation.ts` — `proposerReorganisation`
  (lecture seule), `appliquerReorganisation`, `annulerReorganisation`.
- `src/app/(app)/documents/ReorganiserModal.tsx` — fenêtre en quatre étapes
  (préférence, analyse, aperçu, application).
- `src/app/(app)/documents/DocumentsBrowser.tsx` — bouton et montage de la fenêtre.
- Tests : `reorganisation.test.ts`, `documents-reorganisation.test.ts`,
  `ReorganiserModal.test.tsx`, `DocumentsBrowser.test.tsx`.

## Points d'attention

- **Aucune migration** : seules les tables existantes sont utilisées.
- Gemini reçoit au plus **400** documents classés (les plus récents) ; au-delà,
  l'aperçu l'indique.
- Gemini reçoit les **noms et notes** des documents (jamais les fichiers).
- Les numéros de document remplacent les identifiants dans la consigne : Gemini
  ne peut pas en inventer, et la réponse est courte.
- Même précaution que pour l'analyse du vrac : la réponse de `proposerReorganisation`
  utilise un discriminant `statut` (et non `ok`), sinon `runAction` la prendrait
  pour son propre contrat. Un test passe par `runAction`.
- L'annulation n'est proposée que le temps du message ; ensuite, la page
  Catégories permet de corriger à la main.
- Si l'application échoue en route, les catégories créées pour l'occasion et
  restées inutilisées sont retirées (même logique que le tri du vrac).

## Vérification

- `npx eslint .` : propre. `npx vitest run` : 162 fichiers, 1913 tests passés
  (dont une quarantaine de nouveaux). `npm run build` : réussi.
- `npx tsc --noEmit` : une seule erreur, `LayoutProps` dans `src/app/layout.tsx`,
  **déjà présente sans ces changements** (type global que Next génère au build).
- **Non vérifié** : le rendu réel dans un navigateur et l'appel réel à Gemini
  (pas d'accès à Gemini ni à la base dans cet environnement). À contrôler sur
  téléphone : lancer « Réorganiser », décocher un changement, appliquer, annuler.
