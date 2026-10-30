# Documents — toucher une catégorie n'ouvrait pas ses documents

## Constat

Depuis l'écran Catégories, toucher une catégorie (ex. « Logement ») ramenait sur
la liste de **tous** les documents au lieu de ceux de la catégorie. Le lien était
pourtant correct (`/documents?categorie=Logement`) et la page transmettait bien le
filtre.

## Cause

`DocumentsBrowser` initialisait son filtre avec `useState(categoriesInitiales)` :
la valeur n'était lue qu'**au premier affichage**. Avec `cacheComponents`, Next
conserve l'écran Documents quitté avec son état ; au retour via le lien, le
composant gardait son filtre vide et ignorait le nouveau `?categorie=`. Même défaut
pour l'onglet Vrac (`?vrac=1`, utilisé par le partage Android).

L'hypothèse du « écran conservé par Next » n'a pas pu être reproduite dans cet
environnement (pas de base ni de navigateur) ; les tests la modélisent
(même composant, adresse qui change) et échouent bien sur l'ancien code.

## Décisions

- **L'adresse fait foi** : le filtre est lu dans `?categorie=` (`useSearchParams`).
- Toucher une pastille remplace l'adresse (`history.replaceState`) : aucun pas
  d'historique supplémentaire, pas d'aller-retour serveur ; Retour ramène à
  l'écran précédent. Plusieurs catégories restent possibles.
- Même correctif pour `?vrac=1` ; le basculement Documents / Vrac reste local.
- Recherche et tri restent locaux.
- Hors de l'app router (`useSearchParams` vaut null, tests), un état local prend
  le relais, initialisé par les props existantes.

## Fichiers

- `src/app/(app)/documents/DocumentsBrowser.tsx` — hook `useFiltresAdresse`.
- `src/app/(app)/documents/DocumentsBrowser.test.tsx` — 6 tests « l'adresse fait
  foi » (5 échouent sur l'ancien code).

## Vérification

- `tsc`, `eslint .` propres ; `vitest run` : 162 fichiers, 1919 tests passés ;
  `npm run build` réussi (la route `/documents` reste générée).
- **Non vérifié** : le trajet réel sur téléphone (Documents → icône dossier →
  une catégorie). À contrôler après déploiement, dans les deux sens (aussi depuis
  le menu Plus directement).
