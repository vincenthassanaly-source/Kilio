# Documents — des catégories seulement (plus d'étiquettes, d'échéance ni de mois concerné)

## Demande

Dans le module Documents, ne garder que des **catégories**. Trois points :

1. Plus d'étiquettes « ou autres » classements.
2. Pouvoir **ouvrir une catégorie** pour voir ses documents (l'écran Catégories
   servait seulement à gérer les noms : on ne pouvait rien ouvrir).
3. Bouton « Remettre en vrac » plus petit, discret, en icône.

## Décisions (entretien)

- Gardé dans la fiche : nom, catégorie, fichiers, **notes**, **recto/verso**.
  Retirés : étiquette, **échéance et rappels**, **mois concerné**.
- Recto/verso, qui dépendait du type d'étiquette : un contrôle
  « Document | Recto / verso » en tête des fichiers (présélectionné quand le
  document a déjà un recto ou un verso).
- Accès au contenu d'une catégorie : pastilles de catégories en haut de la page
  Documents (choix multiple), et dans l'écran Catégories, toucher une catégorie
  ouvre `/documents?categorie=<nom>` déjà filtré.
- Bouton « Remettre en vrac » : icône seule (boîte de rangement), 36 px avec zone
  de toucher de 44 px, nom accessible `Remettre « X » en vrac` et info-bulle.
- Base : tout supprimer (étiquettes, colonnes d'échéance, rappels), après
  accord explicite au moment de l'appliquer.

## Choix d'interface (skill ui-ux-pro-max)

- Les pastilles **passent à la ligne** au lieu de défiler dans une rangée coupée
  (règle « Chip Collection Reflow ») ; 16 px entre les rangées pour que les zones
  de toucher ne se chevauchent pas.
- L'état sélectionné ne tient pas qu'à la couleur : **coche** + `aria-pressed`.
- Une icône cliquable porte un nom accessible (`aria-label`), reste dans la même
  famille visuelle que l'app (SVG en trait) et est masquée aux lecteurs d'écran
  (`aria-hidden`).
- Contrôle à deux positions : composant partagé `SegmentedControl`.

## Changements

- **Supprimés** : `documents/etiquettes/` (page, gestionnaire, formulaires),
  `champs.ts`, `echeance.ts`, la fonction Edge `envoyer-rappels-documents` du
  dépôt (la fonction **déployée** et la tâche planifiée sont traitées avec la
  migration, voir plus bas).
- `actions/documents.ts` : plus d'étiquettes, d'échéance ni de période ;
  `updateDocument` renvoie « Document introuvable » si rien n'est mis à jour ;
  tri par défaut du plus récent.
- `DocumentsBrowser` : pastilles de catégories avec leur nombre (celles qui ont
  des documents classés, plus celles sélectionnées), tri Récent / Nom /
  Catégorie, message « Aucun document dans cette catégorie ».
- `DocumentForm` : contrôle Document / Recto-verso, catégorie sur toute la largeur.
- `DocumentCard`, `DocumentDetail` : plus d'étiquette, d'échéance ni de période ;
  `BoutonRemettreEnVrac` (icône).
- `CategoriesManager` : le nom ouvre `/documents?categorie=…`.
- `types.ts` : miroir du schéma mis à jour.

## Base de données — à appliquer APRÈS le déploiement

`scripts/migration-documents-suppression-etiquettes-echeance-2026-10-29.sql`,
**irréversible** : retire la tâche planifiée `rappels-documents`, les colonnes
`etiquette_id`, `date_echeance`, `periode_mois`, `derniere_alerte_envoyee_le` et
la table `etiquettes` (27 étiquettes, 2 documents liés ; colonnes vides pour les
7 documents). Avant le déploiement la page Documents lirait encore `etiquettes` :
d'où l'ordre code d'abord, base ensuite. La fonction Edge déployée
`envoyer-rappels-documents` n'est plus appelée par rien une fois la tâche
retirée ; elle se supprime depuis le tableau de bord Supabase (le connecteur ne
sait pas supprimer une fonction Edge).

## Vérification

- `tsc`, `eslint` propres ; `vitest` : 159 fichiers, 1873 tests ; `next build`
  réussi ; `knip` sans nouveau code mort.
- Nouveaux tests : `DocumentsBrowser` (10 : pastilles, filtre, cumul,
  présélection, tri, vrac), `DocumentForm` (7 : champs retirés, contrôle
  Document / Recto-verso), `BoutonRemettreEnVrac` (3), actions mises à jour.
- **Non vérifié** : le rendu réel sur téléphone et la modification d'un vrai
  document recto/verso (pas de navigateur ni d'accès aux fichiers ici).
