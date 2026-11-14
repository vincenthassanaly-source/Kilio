# Cohérence interne — module Documents (lecture seule, 2026-11-14)

Sources : code `src/app/(app)/documents/**` (liste, `[id]`, `categories`, modales Description / Trier le vrac / Réorganiser), `src/app/actions/documents*.ts`, `EnregistrerDansDocuments.tsx` (Scanner), `registry.ts`, GLOSSARY / PRODUCT / DESIGN, rapports `*documents*` (09-11 à 11-12, dont 10-29 « catégories seules », 10-29 « vrac / Trier », 10-30 « Réorganiser », audit design 11-12). Captures : `reports/audit/documents/` (`ecrans/`, `parcours/`, `scenarios/`).

## Résumé
- Module cohérent dans ses gestes (Ajouter / Modifier / Supprimer avec « Annuler » différé, marqueur IA unique, catégories gérées à part) ; la structure « liste → fiche, catégories à côté, vrac en onglet » tient.
- Le faux Supabase n'a aucune donnée Documents ni stockage de fichiers : seuls les états vides et la gestion des catégories ont été vus ; liste, fiche, vrac et modales IA sont jugés d'après le code (non vérifié visuellement).
- Écarts réels : description du module dans le menu Plus périmée (« échéances », supprimées le 10-29) ; PRODUCT.md n'a aucune section Documents et affirme que le Scanner ne stocke rien en ligne alors que le code l'envoie dans Documents ; impasse quand on touche une catégorie alors qu'il n'y a aucun document.
- Vocabulaire : « Trier » désigne deux gestes (classer avec l'IA / ordonner la liste), « Réorganiser » n'a ni le même style ni la même position qu'en Collection, et le GLOSSARY ignore Vrac / Catégorie / Trier / Réorganiser.
- 8 propositions, surtout S ; aucune ne remet en cause un choix documenté.

## Inventaire des écrans
| Route | Rôle |
|---|---|
| `/documents` (`page.tsx`, `DocumentsBrowser`, `DocumentsList`, `DocumentCard`) | Liste : bouton « Réorganiser » (dès 2 documents classés), carte « Ajouter un document » (`DocumentForm`), onglets Documents / Vrac (si vrac > 0), pastilles de catégories + icône dossier vers Catégories, recherche texte ou « Chercher avec l'IA », tri (Récent / Nom / Catégorie), cartes avec 4 actions (Description IA, Remettre en vrac, Modifier, Supprimer). `?categorie=` et `?vrac=1` pilotent l'état. |
| `/documents/[id]` (`DocumentDetail`) | Fiche : retour « Documents », nom, catégorie, mêmes 4 actions, notes, fichiers (lightbox ou PDF), Partager / Télécharger. Modifier remplace toute la page par le formulaire. |
| `/documents/categories` (`CategoriesManager`) | Ajouter, renommer, fusionner, supprimer (avec « Annuler ») ; toucher une catégorie ouvre `/documents?categorie=<nom>`. |
| Modales | `DescriptionModal` (Gemini), `TriVracModal` (« Trier le vrac », lots de 10, aperçu puis « Appliquer »), `ReorganiserModal` (4 étapes, « Annuler » après application). |
| Entrées hors module | Menu Plus (`registry.ts:275-281`) ; partage Android → `/documents?vrac=1` (`collection/partage/route.ts:39`, `EnvoiVersDocuments.tsx:141`) ; Scanner › « Enregistrer dans Documents » (`ExportPanel.tsx:159-161`) → `/documents?vrac=1`. Pas de FAB, pas de recherche globale (`recherche.ts` : notes, tâches, recettes, courses, événements). |
Pas d'écran orphelin. Captures : `ecrans/documents.{clair,sombre}.png`, `documents_categories.{clair,sombre}.png` (états vides) ; `/documents/[id]` non résolue (aucun document).

## Constats

### Axe A — parcours et hiérarchie
- A1 (moyenne) Impasse quand il n'y a aucun document : l'icône « Gérer les catégories », la recherche et le tri sont dans `!aucunDocument` (`DocumentsBrowser.tsx:233-236`). On peut créer une catégorie depuis Catégories, mais toucher une catégorie (0 document) renvoie à `/documents?categorie=Banque` qui affiche l'état vide générique, sans pastille ni lien retour vers Catégories. Vu : `parcours/categorie-vide-ouvrir/04-screenshot.png`. Vrai comportement du code, pas un artefact (le cas ne se présente qu'à zéro document au total).
- A2 (basse) L'écran Catégories est atteint par une icône dossier sans libellé (`aria-label`/`title` seulement, `DocumentsBrowser.tsx:236-243`), alors qu'elle est la seule porte vers l'ajout/renommage/fusion ; invisible aussi dans l'onglet Vrac et au zéro document. Découvrabilité moyenne pour une fonction de gestion.
- A3 (basse) Doublon liste / fiche : la carte et la fiche offrent les mêmes 4 actions (`DocumentCard.tsx:138-166`, `DocumentDetail.tsx:122-153`) et la carte a trois cibles (vignette = aperçu, nom = fiche, boutons). La fiche n'apporte que notes, grille de fichiers et Partager / Télécharger. Cohérent mais lourd ; la carte pourrait ne garder que Modifier/Supprimer.
- A4 (basse) Modifier remplace toute la fiche (`DocumentDetail.tsx:73-86`) : le retour « Documents » disparaît pendant l'édition, seul « Annuler » ramène. Même patron que la carte, acceptable.
- A5 (basse) Fiche d'un document en vrac : « En vrac : à trier depuis l'onglet Vrac… » (`DocumentDetail.tsx:155-157`) sans lien vers `/documents?vrac=1`, qui existe pourtant.
- A6 (basse, documenté) « Réorganiser » reste visible dans l'onglet Vrac alors qu'il ne traite que les documents classés (rapport 10-30, choix actés). À signaler seulement : un texte d'aide manque dans l'onglet.

### Axe B — vocabulaire et gestes
- B1 (moyenne) « Trier » a deux sens dans le même écran : bouton IA « Trier » / « Trier 10 documents » (`DocumentsBrowser.tsx:~218`, modale « Trier le vrac ») et sélecteur `aria-label="Trier les documents"` (ordre de la liste). Le GLOSSARY n'en dit rien. Même famille : « Réorganiser » (IA, catégories) vs tri d'affichage.
- B2 (moyenne) Le GLOSSARY ne définit ni **Vrac**, ni **Catégorie (de document)**, ni **Trier** / **Réorganiser** (IA), alors que « Suggestion » (défini) est exactement le mot de ces aperçus. Les écrans disent « propose… tu valides » (`DocumentsBrowser.tsx` onglet Vrac) sans employer « Suggestion ». Conforme au sens du glossaire, mais non fixé.
- B3 (basse) « Réorganiser » : en Collection c'est `ghostButton`, `self-start`, avec `aria-label` long et titre de modale « Réorganiser » (`CollectionsGrid.tsx:85-94`, `ReorganiserCollectionsModal.tsx:167`) ; en Documents `secondaryButton`, `self-end`, titre « Réorganiser les documents » (`DocumentsBrowser.tsx:196-204`, `ReorganiserModal.tsx:140`). Même geste IA, deux habillages et deux côtés.
- B4 (basse) Sans catégorie : `<option value="">—</option>` dans le formulaire (`DocumentForm.tsx:343`, libellé « Catégorie (optionnel) ») contre « Sans catégorie » dans la modale de tri (`TriVracModal.tsx:330`).
- B5 (basse) Bouton de validation « Ajouter le document » (`DocumentForm.tsx:471`) ; le GLOSSARY dit « Ajouter » (en création). Et « Enregistrement... » en trois points (`:471`) alors que les modales utilisent « … » (« Application… »).
- B6 (basse) Même texte dans les deux branches du ternaire « Fichiers (photos ou PDF) » (`DocumentForm.tsx:409`) : reste de code sans effet.
- B7 (basse) Cible de l'envoi sans fichier : la bulle native s'affiche (`parcours/ajout-sans-fichier/08-screenshot.png`) mais en anglais (« Please select one or more files. ») sur le Chromium du banc ; la langue dépend du navigateur. L'audit design 11-12 (I1) la disait muette ; à reconfirmer sur un vrai téléphone (je ne l'ai pas pu).
- Conforme : « Supprimer » avec toast « Document « X » supprimé · Annuler » et masquage immédiat (`supprimerAvecAnnulation`, `DocumentCard.tsx:150-160`, `CategoriesManager.tsx:94-109`), conforme au patron différé du GLOSSARY ; « Annuler » pour fermer le formulaire ; « Enregistrer » en modification ; « Ajouter » pour les catégories ; icône étincelle unique pour tout ce qui passe par Gemini (Description, Réorganiser, Trier, Chercher avec l'IA) ; « Retirer » correctement non utilisé (« Remettre en vrac » est un geste propre, choix 10-29).

### Axe C — cohésion fonctionnelle
- C1 (moyenne) Description du module périmée : « Papiers importants et échéances » (`registry.ts:278`). Les échéances et rappels ont été supprimés (rapport 10-29, `documents-categories-seules`). Visible dans le menu Plus.
- C2 (moyenne) PRODUCT.md n'a aucune section Documents (le mot n'apparaît que dans des listes de modules), alors que le module porte du métier non écrit (vrac, Gemini nom + catégorie, Réorganiser, recherche IA, partage Android, catégories gérables). Les seules sources sont les rapports datés (qui, selon PRODUCT.md:77, sont des journaux, pas de la doc).
- C3 (moyenne) Frontière Scanner / Documents : PRODUCT.md:33 décrit le Scanner « sans rien stocker en ligne (aucune table, aucun bucket, aucune Server Action) ». Le code a un bouton opt-in « Enregistrer dans Documents » (`ExportPanel.tsx:159-161`, `EnregistrerDansDocuments.tsx`) qui appelle `preparerUploadsVrac` / `enregistrerDocumentsVrac` et envoie le PDF dans le vrac ; le texte de vidage du brouillon le mentionne (`ExportPanel.tsx:178`). Donc la frontière a déjà bougé et la doc produit n'a pas suivi ; ce n'est pas un doublon (le Scanner produit, Documents range), mais la phrase PRODUCT.md est fausse. Non testé : chemin scanner → upload (stockage non simulé).
- C4 (basse) Vrac = file d'arrivée de 3 sources (partage Android, Scanner, rien d'autre : l'ajout manuel classe directement, onglet Documents seulement `DocumentsBrowser.tsx:207`). Cohérent, mais on ne peut pas ajouter directement au vrac depuis l'écran lui-même (la carte Ajouter disparaît dans l'onglet Vrac) : choix implicite à confirmer.
- C5 (basse) Deux outils de refonte des catégories : écran Catégories (manuel : renommer, fusionner, supprimer) et « Réorganiser » IA (fusions, renommages, déplacements). Complémentaires et décrits comme tels (10-29, 10-30) ; seul le premier est atteint par une icône sans texte (cf. A2).
- C6 (basse) Pas de point d'entrée Documents ailleurs que Plus (pas de FAB, pas de recherche globale `recherche.ts`). Documents a sa propre recherche (texte + IA) : acceptable, mais un document est introuvable depuis la recherche globale.
- Aucun doublon de composant : `DocumentForm` partagé ajout / modification / carte / fiche ; `BoutonDescription` et `BoutonRemettreEnVrac` partagés liste / fiche ; `SegmentedControl` et `Modal` communs.

## Propositions

- **P1 — Corriger la description du module dans le menu Plus (C1).** « Papiers importants et échéances » → « Papiers, photos et PDF classés par catégorie ». Effet : texte fidèle. Effort S, risque nul. Fichier : `src/lib/navigation/registry.ts` (+ test si le libellé est testé). Dépend : rien.
- **P2 — Écrire la section Documents de PRODUCT.md et corriger la phrase du Scanner (C2, C3).** Ajouter un paragraphe Documents (catégories, vrac, Trier, Réorganiser, recherche IA, partage Android) et préciser dans la section Scanner que « Enregistrer dans Documents » envoie le PDF dans le vrac (le reste reste local). Effort S, risque nul. Fichier : `PRODUCT.md`. Dépend : rien. À valider par Vincent : la phrase « sans rien stocker en ligne » est-elle encore voulue comme principe ?
- **P3 — Compléter le GLOSSARY (B1, B2).** Entrées **Vrac** (état `en_vrac`, onglet), **Catégorie** (de document, table gérable), **Trier** (classer le vrac avec l'IA, résultat = Suggestion) vs **Tri** (ordre d'affichage), **Réorganiser** (refonte IA des catégories / collections). Effort S, risque nul. Fichier : `GLOSSARY.md`. Dépend : rien.
- **P4 — Renommer le sélecteur d'ordre « Trier les documents » en « Ordre » (B1).** Le bouton IA garde « Trier ». Effort S, risque : tests `DocumentsBrowser.test.tsx` à ajuster (nom accessible). Fichier : `DocumentsBrowser.tsx` (+ test). Dépend : P3 pour la décision de mot.
- **P5 — Lever l'impasse au zéro document (A1, A2).** Sortir l'icône « Gérer les catégories » de `!aucunDocument` (et la laisser dans l'onglet Vrac), ou, si une catégorie filtrée n'a aucun document, afficher la pastille cochée et « Aucun document dans cette catégorie » au lieu de l'état vide générique. Option complémentaire : libellé visible « Catégories » à côté de l'icône. Effort S-M, risque faible (tests du navigateur à ajuster, l'audit 10-30 a déjà tordu ce bloc). Fichiers : `DocumentsBrowser.tsx`, `DocumentsList.tsx`. Dépend : rien.
- **P6 — Aligner « Réorganiser » entre Documents et Collection (B3).** Même style de bouton, même côté, même titre de modale (« Réorganiser » + sous-titre). Effort S, risque faible (visuel + tests). Fichiers : `DocumentsBrowser.tsx`, `ReorganiserModal.tsx`, `CollectionsGrid.tsx`, `ReorganiserCollectionsModal.tsx`. Dépend : arbitrage Vincent sur la forme retenue ; touche le module Collection (voir inter-modules).
- **P7 — Petits alignements de libellés (B4, B5, B6, A5).** « — » → « Sans catégorie » dans le select ; « Enregistrement... » → « Enregistrement… » ; retirer le ternaire identique ; lien « Ouvrir le vrac » dans la fiche d'un document en vrac. Effort S, risque nul à faible. Fichiers : `DocumentForm.tsx`, `[id]/DocumentDetail.tsx`, tests associés. Dépend : rien. Ne pas toucher « Ajouter le document » sans arbitrage (B5 : le GLOSSARY dit « Ajouter », mais le nom complet est plus lisible hors contexte).
- **P8 — Alléger la carte de liste (A3).** Ne garder sur la carte que Modifier / Supprimer et renvoyer Description IA et Remettre en vrac à la fiche. Effort M, risque moyen (geste fréquent « Remettre en vrac » depuis la liste ; l'icône a été voulue sur la carte au 10-29). À ne faire que si Vincent la juge trop chargée : sinon laisser.

À ne pas faire (déjà tranché) : dossiers (supprimés 09-11), étiquettes / échéances / rappels (supprimés 10-29), vrac comme état et non comme dossier, bouton « Remettre en vrac » en icône seule, aperçu avant « Appliquer » pour Trier et Réorganiser, « Réorganiser » visible dans tous les onglets.

## Pistes inter-modules
- Scanner : le bouton « Enregistrer dans Documents » (+ « Voir dans Documents ») est le seul pont ; mettre à jour la phrase de PRODUCT.md (P2). Un Scanner qui proposerait aussi une catégorie à l'envoi remettrait en cause « le tri se fait ensuite dans Documents » (`EnregistrerDansDocuments.tsx:23-27`) : non recommandé.
- Collection : mêmes motifs « Réorganiser » IA et « catégorie/collection » ; une charte commune des gestes IA (P6) vaut pour les deux modules.
- Recherche globale : Documents absent (`recherche.ts`). L'ajouter ouvrirait `/documents?...` ; à arbitrer avec la recherche IA propre au module.
- Menu Plus : l'entrée Documents et l'entrée Scanner partagent `--accent-documents` ; voulu ou non, à confirmer côté navigation.
- Réglages : la fonction Edge de rappels documents a été retirée du dépôt (10-29) ; la fonction déployée et la tâche planifiée étaient « traitées avec la migration » : à confirmer côté base (hors périmètre, non vérifié).

## Ce qui n'a pas pu être testé
- Artefacts du faux Supabase : aucune donnée `documents` / `documents_files`, pas de stockage de fichiers, pas de clé Gemini : donc liste avec cartes, pastilles, filtres, tri, recherche texte et IA, onglet Vrac, Trier, Réorganiser, Description, fiche `/documents/[id]` (non résolue par `ecrans.mjs`), Partager / Télécharger, lightbox, envoi réel d'un document et partage Android sont jugés d'après le code : **non vérifié visuellement**. Je n'ai pas modifié `e2e/mock-supabase.mjs` (consigne lecture seule).
- Vus et OK sur le banc : états vides de `/documents` et `/documents/categories` (clair, sombre), formulaire d'ajout, ajout d'une catégorie + rechargement (persistée), envoi du formulaire sans fichier (bulle native), toucher une catégorie vide.
- Bruit du banc, pas des bugs : 404 `/_vercel/speed-insights/script.js`, `GET ...?_rsc` / `POST /documents/categories` annulés (`ERR_ABORTED`).
- Données modifiées par mes parcours (sans `--reset`) : une catégorie « Banque » dans le faux Supabase (créée une fois, le rejouage a pu échouer en doublon).
- Outil : Playwright du skill ne trouvait pas Chromium 1194 ; j'ai utilisé les copies déjà présentes dans le scratchpad (`executablePath` vers 1243), skill inchangé. Critique impeccable sautée (consigne).
- Non testé : vrai téléphone (langue de la bulle de validation, caméra, feuille de partage), hors ligne, base réelle.

## Résumé (5 lignes)
- Module cohérent sur les gestes (suppression annulable, catégories, marqueur IA) ; structure liste / fiche / catégories / vrac lisible.
- Écarts réels : description Plus périmée (« échéances »), PRODUCT.md sans section Documents et faux sur le Scanner, impasse au zéro document avec une catégorie ouverte.
- Vocabulaire : « Trier » à double sens, « Réorganiser » habillé différemment de Collection, GLOSSARY muet sur Vrac / Catégorie.
- Liste, fiche, vrac et modales IA non vérifiés visuellement (aucune donnée ni stockage dans le faux Supabase).
- 8 propositions (P1-P4, P7 S ; P5 S-M ; P6 S ; P8 M optionnelle), aucune ne contredit un choix documenté.

Rapport : /home/user/Kilio/reports/refonte-modules/documents.md
