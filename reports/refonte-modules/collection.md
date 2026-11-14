# Cohérence interne — module Collection (lecture seule, 2026-11-14)

Sources : code `src/app/(app)/collection/**`, `src/app/collection/partage/**`, `src/app/actions/collections.ts`, `src/lib/navigation/registry.ts`, GLOSSARY/PRODUCT/DESIGN, rapports `*collection*` (dont audit design 11-12, partage-sélection-visuelle 09-12, tiktok 09-09, youtube 09-22, share-target 09-02). Captures : `reports/audit/collection/` (`ecrans/`, `parcours/`).

## Résumé
- Module cohérent et déjà bien poli : 2 niveaux (liste de mosaïques, détail), vocabulaire conforme au GLOSSARY (« élément », Supprimer en entier, Annuler/Enregistrer/Appliquer), suppression différée avec toast « Annuler ».
- Écarts réels mais mineurs : patrons d'ajout différents entre « collection » et « élément », « Réorganiser » et « Décrire » (IA) placés comme des gestes de même rang que l'ajout, boutons Supprimer/Renommer visibles en permanence sous le titre.
- Cohésion : le parcours de partage (`/collection/partage/choisir`) est en fait un écran multi-destinations (Collection, Tâche, Documents vrac) logé dans le module Collection.
- Le seul accès au module est par « Plus » (barre du bas sans Collection) : choix de préférences, à ne pas toucher ici.
- 5 propositions (S/M), aucune ne remet en cause un choix déjà tranché.

## Inventaire des écrans
| Route | Rôle |
|---|---|
| `/collection` (`page.tsx`, `CollectionsGrid`, `CollectionMosaic`, `AddCollectionToggle`) | Carte « Ajouter une collection » (repliée), bouton « Réorganiser » (IA, masqué si liste vide), mosaïque 2 colonnes (aperçu, nom, « N éléments »). Pull-to-refresh. |
| `ReorganiserCollectionsModal` | Modale IA : intro → analyse (Arrêter) → propositions cochables → « Appliquer (N) », puis toast « Annuler » (`:150`). |
| `/collection/[id]` (`CollectionDetailView`, `CollectionHeader`, `AddPhotoButton`, `PhotosGrid`) | Retour « Collection », titre, Renommer / Supprimer, Appareil photo / Galerie / Lien vidéo, bannière « N éléments à décrire avec l'IA » + « Décrire », grille (lightbox photo, VideoFeed vidéo, Copier le lien, croix de suppression). |
| `TitrageModal` | Modale IA « Décrire » : analyse → propositions → « Appliquer (N) ». S'ouvre aussi seule après un ajout (`CollectionDetailView.tsx:36-41`). |
| `/collection/partage` (route POST) | Cible Web Share Target (manifest) : upload, redirige vers `/choisir`. Pas d'écran. |
| `/collection/partage/choisir` (+ `DestinationPartage`, `ChoisirCollectionForm`, `PhotosPartageesEnAttente`, `PhotosDejaEnvoyees`, `EnvoiVersDocuments`) | Écran « Que faire de ce partage ? » (ou « Ajouter à une collection » si lien vidéo) : choix Documents (vrac) / Collection / Tâche. |
| `loading.tsx` ×3 | Squelettes. |
Hors module : entrée par « Plus » (`registry.ts:219-225`), `ImageLightbox`, `VideoFeed`. Pas d'écran orphelin. Captures : `ecrans/collection.*`, `collection_id.*`, `partage_choisir.*` (clair + sombre), `parcours/01-08`.

## Constats

### Axe A — parcours et hiérarchie
- A1 (basse) Liste → détail : 1 tap ; ajout d'une collection : 2 taps + saisie (carte → nom → Ajouter), sans quitter la liste, nouvelle collection non ouverte automatiquement (`parcours/02`). Acceptable.
- A2 (moyenne) Geste le plus fréquent (ajouter des photos) : 1 tap sur « Appareil photo/Galerie » puis une fenêtre « Décrire » s'ouvre d'elle-même après l'envoi (`CollectionDetailView.tsx:36-41`, `AddPhotoButton.tsx:111,140`). Déjà relevé à l'audit design 11-12 (I3) comme décision produit ouverte ; non remis en cause ici, signalé car il pèse sur la hiérarchie : l'IA s'impose au geste principal. Non vérifié visuellement (aucun élément dans le faux Supabase).
- A2b (basse) En-tête du détail : Renommer et Supprimer occupent la première ligne d'actions, au-dessus de l'ajout d'éléments (`parcours/03`). Geste rare (gestion) placé avant le geste fréquent (ajout) ; la suppression de collection est à côté de « Renommer » en rouge, toujours exposée.
- A3 (basse) Liste vide du détail : « Ajoute des photos ou un lien vidéo avec les boutons ci-dessus » (`PhotosGrid.tsx:132`) : cohérent et sert de guide.
- A4 (basse) « Réorganiser » (IA, sur toute la collection, jusqu'à 50 s) est exposé au même niveau que « Ajouter une collection » sur la liste (`CollectionsGrid.tsx:69-79`) ; geste rare, très puissant (fusion/renommage). Protégé par aperçu + « Appliquer » + « Annuler » : risque limité.
- A5 (basse) Le retour (BackLink « Collection ») fonctionne ; après suppression, retour à `/collection` immédiat (`parcours/08`, vérifié).

### Axe B — vocabulaire et gestes
- B1 (basse) Conformité GLOSSARY : « élément(s) » partout sur les tuiles (`CollectionsGrid.tsx:48`) ; mais le détail et les erreurs parlent de « photo » (aria « Supprimer la photo/la vidéo », `PhotosGrid.tsx:194`) : acceptable car type précis, mais le vide dit « Aucun élément ». Rien à corriger.
- B2 (moyenne) Deux patrons d'ajout pour deux objets proches : « Ajouter une collection » = carte repliée `AnimatedAddCard` avec formulaire + « Annuler » (`AddCollectionToggle.tsx`) ; ajout d'élément = 3 boutons en pointillés + champ lien (`AddPhotoButton.tsx:180-229`) avec bouton « Ajouter » sans « Annuler » (le lien vidéo se referme en retapant « Lien vidéo »). Écart faible mais visible : un champ ouvert sans Annuler, contrairement à Courses/Notes.
- B3 (basse) Message de validation du champ lien en anglais, « Please enter a URL. » (`parcours/05`) : validation HTML native de `type="url"` (`AddPhotoButton.tsx:206`) qui n'atteint jamais le message maison « Lien TikTok ou YouTube invalide » pour du texte libre ; cohérence de langue et de ton rompue sur le seul chemin d'erreur. Vrai comportement (pas un artefact du mock).
- B4 (basse) Suppression : `PhotosGrid` supprime sur croix (icône ×), libellé accessible « Supprimer la photo » ; une croix évoque plutôt « Retirer » (GLOSSARY:31-33 : Retirer = ôter sans détruire). Ici l'élément et son fichier sont détruits : le verbe est juste, l'icône ambiguë. À noter, pas à changer sans design.
- B5 (basse) Les boutons des deux modales IA sont cohérents entre eux (Arrêter / Annuler / Appliquer (N)) et avec le GLOSSARY (Annuler = fermer sans rien enregistrer). « Fermer » (`ReorganiserCollectionsModal.tsx:234`) = état d'erreur/vide, acceptable.
- B6 (basse) Le toast de suppression de collection suit exactement le patron GLOSSARY : « Collection « X » supprimée · Annuler » (`parcours/07`), appel serveur différé. Conforme.
- B7 (basse) « Enregistrer » pour le renommage (`CollectionHeader.tsx`) vs « Ajouter » pour la création : conforme à la charte.

### Axe C — cohésion fonctionnelle
- C1 (moyenne) `/collection/partage/choisir` sert de routeur de partage vers Documents (vrac), Collection et Tâche (`DestinationPartage.tsx:60-84`, `route.ts:30-46` crée aussi des documents). Le module Collection héberge donc une logique de partage transverse : l'URL et le code sont sous `collection/` alors que 2 destinations sur 3 n'en sont pas. Décision documentée (rapport 09-02 share-target) d'origine ; à signaler, pas à remettre en cause.
- C2 (basse) « Décrire » (titrage IA) et « Réorganiser » (IA) sont deux fonctions IA du même module avec deux modales distinctes très proches (analyse → propositions → Appliquer (N)) : même patron, bonne cohésion. `ReorganiserControles` partagé avec Documents (`src/components/ReorganiserControles.tsx`) : réutilisation.
- C3 (basse) Les liens vidéo (TikTok/YouTube) cohabitent avec les photos dans la même grille (« élément »), choix tranché (rapports 09-09, 09-22). Cohérent.
- C4 (basse) Aucun doublon d'écran. `CollectionMosaic` n'est utilisé que sur la liste ; `PhotosGrid` ne ressemble pas à la mosaïque de la liste (volontaire : cadre du détail vs aperçu).
- C5 (basse) Recherche globale : à vérifier si les collections sont indexées (non lu ici, hors module).

## Propositions

- **P1 — Désactiver la validation native du champ lien (B3).** `<form noValidate>` ou `type="text" inputMode="url"` sur `AddPhotoButton.tsx:204-209` pour laisser la validation serveur renvoyer « Lien TikTok ou YouTube invalide » (en français). Effet : plus de bulle anglaise. Effort S. Risque : faible (le message d'exception brut en production est déjà un point ouvert de l'audit 11-12 I1, à traiter ensemble). Fichiers : `AddPhotoButton.tsx` (+ test). Dépend : correctif I1 de l'audit design (message lisible).
- **P2 — Ajouter « Annuler » au champ lien vidéo (B2).** Même rangée que « Ajouter » (`textButton`), identique à `AddCollectionToggle`. Effet : un seul patron d'ajout replié. Effort S, risque nul. Fichier : `AddPhotoButton.tsx`.
- **P3 — Ranger Renommer/Supprimer après l'ajout d'éléments, ou dans un menu (A2b).** Option minimale : déplacer la rangée sous la zone d'ajout, ou ne garder qu'un bouton « Modifier » ouvrant Renommer / Supprimer. Effet : le geste fréquent passe en premier, le destructif est moins exposé. Effort M, risque : tests `CollectionHeader.test.tsx`, choix de design à valider avec Vincent. Fichiers : `CollectionDetailView.tsx`, `CollectionHeader.tsx`.
- **P4 — Ne plus ouvrir « Décrire » automatiquement (A2).** S'appuyer sur la bannière existante. Déjà proposé (audit 11-12 I3) et classé « non sûr » (décision produit) : à arbitrer par Vincent, je ne le présente que comme dépendance de la hiérarchie. Effort S, risque : comportement. Fichiers : `CollectionDetailView.tsx`, `AddPhotoButton.tsx`.
- **P5 — Documenter dans PRODUCT.md le routeur de partage (C1).** Une ligne : « `/collection/partage/choisir` choisit entre Collection, Tâche et Documents (vrac) ». Effort S, risque nul. Fichier : `PRODUCT.md`. Option plus lourde (déplacer sous `/partage`) à ne pas faire sans besoin (manifest et service worker pointent déjà dessus).

À ne pas faire (déjà tranché) : mélange photos + liens vidéo dans une même collection, suppression différée avec toast « Annuler », titrage et réorganisation en deux temps (aperçu puis Appliquer), vocabulaire « élément ».

## Pistes inter-modules
- Partage (C1) : extraire en module « Partage » (Collection / Tâche / Documents) : touche Documents et Tâches, manifest et `public/sw.js`.
- Barre du bas : Collection n'est accessible que par « Plus » (comme sur le banc) ; PRODUCT.md:23 donne le défaut Aujourd'hui · Courses · Nutrition · Tâches : rien à changer.
- `ReorganiserControles` partagé avec Documents : harmoniser les libellés « Réorganiser » entre les deux modules (module Documents).
- Recherche globale : vérifier que Collection est interrogeable (module Recherche).

## Ce qui n'a pas pu être testé
- Faux Supabase : une seule collection fixture « Voyage Lisbonne », 0 élément (`e2e/mock-supabase.mjs:221-224`). Donc non rendus : grille de photos/vidéos réelle, lightbox, VideoFeed, bannière « à décrire », modales `TitrageModal` et `ReorganiserCollectionsModal` (Gemini, hors banc), `/collection/partage/choisir` avec contenu (seul l'état « Rien reçu » vu), route POST de partage. Jugés d'après le code, « non vérifié visuellement ».
- Artefact probable du mock, à ne pas prendre pour un bug : après « Supprimer » puis 8 s, la collection de test reste présente après rechargement et aucun DELETE n'est arrivé dans `/__writes` (seul le POST de création y figure). `deleteCollection` appelle d'abord le stockage (`retirerObjetsStorage`, `collections.ts:218`), que le faux Supabase ne simule pas : l'erreur y est vraisemblable. Cause non établie ; à rejouer sur un environnement avec stockage avant de conclure à un vrai bug. L'écran, lui, retourne bien à `/collection` et affiche le toast.
- Erreurs console `/_vercel/speed-insights/script.js` 404 : bruit du banc.
- Outil : Playwright du skill cherchait Chromium 1194 (absent) ; j'ai lancé un script maison dans le scratchpad avec `executablePath` vers `/opt/pw-browsers/chromium-1243`, sans `--reset`, sans modifier le skill. Les données mock ont reçu une collection « Recettes test ».
- Non testé : appareil photo / galerie (sélecteur de fichiers), compression, hors ligne et file Dexie, Web Share Target réel Android et service worker, vibration, gestes tactiles fins, base réelle.

## Résumé en 5 lignes
1. Module cohérent (liste → détail, vocabulaire « élément », suppression différée conforme au GLOSSARY).
2. Écarts : patron d'ajout différent entre collection et élément, bulle de validation en anglais sur le lien, Renommer/Supprimer exposés avant l'ajout.
3. Cohésion : le routeur de partage (Collection/Tâche/Documents) vit sous `collection/` ; IA « Décrire » s'impose après chaque ajout (déjà signalé 11-12).
4. Faux Supabase sans éléments : grille, modales IA et partage non vérifiés visuellement ; suppression non persistée sur le banc, probablement artefact du stockage non simulé.
5. 5 propositions S/M, aucune ne contredit un choix tranché.

Rapport : /home/user/Kilio/reports/refonte-modules/collection.md
