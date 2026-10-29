# Documents — vrac, bouton « Trier » (Gemini) et partage Android

## Contexte

Vincent voulait pouvoir partager des documents (photos, PDF) depuis Android vers
Kilio, les retrouver dans un « vrac », puis les renommer et les classer d'un
clic avec Gemini. Les dossiers ayant été supprimés du module
(`2026-09-11-suppression-dossiers-documents.md`), le vrac n'est pas un dossier
mais un état du document (`documents.en_vrac`). Le cadrage complet vient d'un
entretien (décisions ci-dessous).

## Décisions

- Vrac = colonne `en_vrac`, onglet « Vrac (n) » dans `/documents`.
- Gemini remplit le **nom** (titre descriptif libre) et la **catégorie** — pas
  l'étiquette, pas l'échéance.
- Catégories désormais **gérables** (table `documents_categories`, écran
  `/documents/categories` : ajouter, renommer, fusionner, supprimer). Gemini
  réutilise les existantes et peut en proposer de nouvelles, signalées
  « nouvelle » dans l'aperçu et créées seulement à l'application.
- **Aperçu avant application** : nom et catégorie modifiables, case à décocher ;
  rien n'est écrit avant « Appliquer ».
- Lots de **10** documents ; un échec (quota, illisible, trop volumineux) reste
  en vrac avec un message, sans bloquer les autres.
- Partage Android : destination « Documents (vrac) » ajoutée à l'écran de choix
  existant ; envoi **direct vers Supabase Storage par URL signée** (pas de
  plafond Vercel de 4,5 Mo), seulement pour le partage. Le formulaire Documents
  garde sa limite de 4 Mo.

## Fichiers

- `scripts/migration-documents-vrac-2026-10-29.sql` — **à appliquer à la main**
  (éditeur SQL Supabase) : colonne `documents.en_vrac`, table
  `documents_categories` (6 catégories d'origine), RLS activée.
- `src/lib/documents/tri.ts` — consigne Gemini, schéma, lecture défensive de la
  réponse (catégorie reconnue malgré casse/accents, nouvelle sinon).
- `src/app/actions/documents-vrac.ts` — `analyserDocumentVrac` (un document,
  lecture seule), `appliquerTriVrac`, `preparerUploadsVrac`,
  `enregistrerDocumentsVrac`.
- `src/app/actions/documents-categories.ts` — gestion des catégories.
- `src/app/(app)/documents/` — `TriVracModal.tsx`, onglet Vrac dans
  `DocumentsBrowser.tsx`, `categories/`, `DocumentForm.tsx` (catégories
  dynamiques). `page.tsx` : `maxDuration = 60` et `?vrac=1`.
- Partage : `public/manifest.json` (accepte aussi les PDF), `public/sw.js`,
  `src/app/collection/partage/route.ts` (chemin de secours sans service
  worker : les non-images deviennent des documents en vrac),
  `choisir/EnvoiVersDocuments.tsx`, `DestinationPartage.tsx`,
  `PhotosPartageesEnAttente.tsx`, `src/lib/partage/enAttente.ts`,
  `src/lib/documents/televersement.ts`.
- `src/lib/documents/detecterFormat.ts` — réécrit sans `Buffer` (utilisé aussi
  côté navigateur).

## Points d'attention

- **Tant que la migration n'est pas appliquée**, l'app se comporte comme avant :
  `getCategories` et la validation de catégorie retombent sur les 6 catégories
  d'origine. Le vrac et la gestion des catégories ne fonctionnent qu'après.
- Un PDF partagé sans type MIME est reconnu par sa signature (`%PDF-`).
- Après le déploiement, **réinstaller la PWA** (ou la rouvrir pour que Android
  relise le manifest) est parfois nécessaire pour que les PDF apparaissent
  dans le menu Partager.
- Gemini reçoit au plus 3 fichiers par document, 14 Mo au total ; au-delà, le
  document reste en vrac (« trop volumineux pour l'analyse »).
- Les fichiers envoyés puis non enregistrés (échec en cours de route) restent
  orphelins dans le bucket ; aucun nettoyage automatique n'existe pour eux.

## Vérification

- `npx tsc --noEmit`, `npx eslint .` : propres.
- `npx vitest run` : 154 fichiers, 1828 tests passés (dont ~45 nouveaux : tri,
  actions vrac et catégories, téléversement, repli sans migration).
- `npm run build` : réussi, routes `/documents/categories` et
  `/collection/partage/choisir` générées.
- **Non vérifié** : le rendu réel dans un navigateur, l'appel réel à Gemini et
  l'envoi par URL signée vers le vrai bucket (pas d'accès Supabase/Gemini
  dans cet environnement). À contrôler sur téléphone après l'application de la
  migration.

## Correctif — tri figé à « 0 / 1 » (même jour)

Premier essai réel : l'écran « Gemini lit tes documents… » restait à 0 / 1.

- **Cause** : `analyserDocumentVrac` renvoyait `{ ok: true, proposition }`.
  `runAction` prend toute réponse `{ ok: true, … }` pour son propre contrat
  `ActionResult` et la renvoie telle quelle, sans `data` ; le modal lisait
  `resultat.data.ok`, levait une `TypeError` dans une boucle async sans
  `try/catch`, et l'écran ne bougeait plus. Seul le cas de succès cassait.
- **Correctif** : discriminant `statut` (`"ok"` / `"echec"`) au lieu de `ok`
  pour cette réponse ; boucle d'analyse sous `try/catch` (une erreur imprévue
  devient une ligne « reste en vrac ») ; annulation propre à chaque exécution de
  l'effet (le `ref` partagé relançait la première boucle en StrictMode).
- **Pourquoi les tests ne l'avaient pas vu** : ils appelaient l'action seule,
  jamais à travers `runAction`. Deux tests de régression passent maintenant par
  `runAction` (`documents-vrac.test.ts`).
- Audit `click-path-audit` du parcours : aucun autre contrat de réponse
  incompatible (partage Android, catégories, application du tri).

## Évolution — création de catégories et détection des doublons (même jour)

**Catégories.** Les 6 catégories d'origine n'avaient jamais été complétées : la
consigne demandait de réutiliser une existante « même approximativement » et de
choisir « Autre » en cas de doute, donc Gemini ne créait rien. Nouvelle
consigne (`construirePromptTri`) : choisir dans la liste si une catégorie
correspond franchement, sinon **créer** une catégorie large (1 ou 2 mots :
« Travail », « Banque »…, pas un type de document) ; « Autre » en dernier
recours seulement (illisible ou impossible à classer). Pas de plafond ; les
nouvelles catégories restent signalées « (nouvelle) » dans l'aperçu.

**Doublons** (`scripts/migration-documents-empreinte-2026-10-29.sql`, colonne
nullable `document_fichiers.empreinte`) :

- *Même fichier* (certain) : empreinte SHA-256, calculée par
  `analyserDocumentVrac` quand le tri télécharge déjà le fichier pour Gemini et
  mémorisée. Comparée aux fichiers de tous les autres documents, classés ou
  déjà analysés dans le vrac. Les fichiers classés sans empreinte sont
  complétés au fil des tris (15 au plus par analyse). Un doublon exact saute
  l'appel à Gemini (la proposition reprend le nom et la catégorie de l'original).
- *Même titre* (probable) : le titre proposé par Gemini est comparé (casse,
  accents et ponctuation ignorés) aux titres des documents classés, et dans
  l'aperçu, entre documents du même lot.
- Dans l'aperçu : message « Même fichier que… » / « Titre identique à… », lien
  « Ouvrir l'existant », case **décochée par défaut** (le document reste en vrac,
  rien n'est supprimé sans action de ta part).
- Les fichiers du vrac pas encore analysés ne sont pas complétés : le premier
  analysé d'un lot de copies reste l'original, les suivants sont signalés.
- Sans la migration, le tri fonctionne comme avant et ne détecte que par titre.
- Limite : une photo ajoutée par le formulaire (compression serveur) puis
  partagée depuis le téléphone (compression navigateur) n'a pas les mêmes
  octets ; seul le titre peut la repérer.

## Évolution — remettre n'importe quel document en vrac (même jour)

Bouton **« Remettre en vrac »** sur chaque carte de document et sur la page de
détail (masqué pour un document déjà en vrac), pour retrier un document déjà
classé avec Gemini. Aucune migration : seul le drapeau `en_vrac` change
(`definirDocumentEnVrac`).

- Le document garde nom, catégorie, étiquette, échéance et notes jusqu'au tri ;
  le tri ne remplace que le nom et la catégorie, après l'aperçu.
- Il n'apparaît plus que dans l'onglet Vrac (comme les documents partagés) ; la
  page de détail indique « En vrac » à la place du bouton.
- Pas de confirmation avant (geste sans risque) : un message propose
  « Annuler » (`remettreEnVrac.ts`), qui remet le drapeau à faux.
- Un document retrié ne se signale jamais comme doublon de lui-même.
