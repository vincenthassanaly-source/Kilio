# Cohérence interne — module Scanner (lecture seule, 2026-11-14)

Sources : code `src/app/(app)/scanner/*` (ScannerApp, Viseur, EditeurCoins, ApercuPage, ExportPanel, EnregistrerDansDocuments), `lib/scanner/brouillon.ts`, `lib/navigation/registry.ts`, GLOSSARY / PRODUCT (paragraphe Scanner) / DESIGN, rapport `2026-11-12-audit-design-scanner.md`. Les algorithmes de détection n'ont pas été lus. Captures : `reports/audit/scanner/` (`ecrans/` clair + sombre ; `parcours/import-export/01…14`).

## Résumé
- Parcours court et lisible : Scanner / Importer → recadrage → liste de pages → Exporter (PDF/JPEG) → Partager, Télécharger ou Enregistrer dans Documents. Pas de bug d'usage sur le banc (import ×2, recadrage, aperçu, rechargement, Reprendre, suppression + Annuler, vidage).
- Les écarts viennent de l'enchaînement de fin de parcours : Exporter est tout en bas d'une liste de grandes cartes, « Vider le brouillon » n'existe qu'après « Créer le PDF », et le texte d'introduction nomme un bouton qui n'est pas encore visible.
- Cohésion avec Documents : lien à sens unique et PDF seul (le JPEG ne peut pas aller dans Documents) ; aucun doublon ni écran orphelin.
- Vocabulaire globalement conforme au GLOSSARY ; trois points de langue mineurs (« enregistrer » employé pour trois gestes, « Valider », « Terminer » doublon de la croix).
- 6 propositions, S à M, aucune ne remet en cause « pas de réordonnancement, rotation ni réouverture du recadrage en v1 ».

## Inventaire des écrans
| Écran | Fichier | Rôle |
|---|---|---|
| `/scanner` (liste) | `page.tsx`, `ScannerApp.tsx` | Titre, phrase d'intro, boutons Scanner / Importer, état vide, cartes « Page N » (miniature, Reprendre, Supprimer), carte Exporter. Seule route du module. Capture `ecrans/scanner.clair.png`, `.sombre.png`. |
| Viseur (plein écran, overlay) | `Viseur.tsx` | Caméra arrière, pastille « Feuille repérée / Cherche la feuille… », Importer, déclencheur, « Terminer (N) », croix. |
| Recadrage (overlay, file de photos) | `EditeurCoins.tsx` | 4 coins déplaçables, loupe, Annuler / Photo entière / Valider (`01`, `10`). |
| Aperçu plein écran (overlay) | `ApercuPage.tsx` | Zoom, « 1 / 2 », flèches, bascule Original / Résultat (`05`). |
| Carte Exporter | `ExportPanel.tsx`, `EnregistrerDansDocuments.tsx` | Nom, Format, Qualité, Créer, puis Partager / Télécharger / Enregistrer dans Documents / Vider (`06`). |
| Confirmation | `ExportPanel.tsx:171-180` | « Vider le brouillon ? » (`13`). |
Point d'entrée : menu Plus, `registry.ts:282-288` (« Numériser des documents en PDF ou en images »). Aucun lien depuis Documents (`grep scanner` dans `documents/` : rien). Pas d'écran orphelin, pas de sous-route.

## Constats

### Axe A — parcours et hiérarchie
- A1 (moyenne) Exporter est loin. Chaque page occupe une carte d'environ 150 px (`ScannerApp.tsx:204-228`) dont la moitié est vide ; avec 2 pages la carte Exporter commence déjà au-delà du premier écran (capture `04-liste-full`), avec 8 à 10 pages il faut défiler plus de deux écrans, sans bouton « Exporter » ni compteur flottant. La barre du bas masque en plus le bas de la carte. Le geste final du module (le plus important) n'est pas visible depuis le geste le plus fréquent (scanner).
- A2 (moyenne) « Vider le brouillon » n'apparaît qu'après avoir généré un fichier (`ExportPanel.tsx:140-163` : bouton dans la branche `fichiers`). Pour repartir de zéro sans exporter il faut supprimer les pages une à une (N taps + N toasts). La confirmation « Vider le brouillon ? » (`:171-180`) mentionne pourtant « Partager, Télécharger ou Enregistrer dans Documents » comme préalable, ce qui suppose le fichier déjà prêt.
- A3 (moyenne) Pour envoyer dans Documents : Scanner → (photo, Valider)×N → Créer le PDF → Enregistrer dans Documents, soit un tap de génération intermédiaire que l'utilisateur ne distingue pas de l'envoi. Cohérent avec « génère puis choisis la sortie », mais c'est le cas d'usage probable de Vincent (papiers → Documents) ; le fichier prêt n'est exploitable qu'en 1 fichier PDF.
- A4 (basse) Reprendre n'est pas signalé dans le viseur : la page à remplacer n'est pas transmise à `Viseur` (props `nombrePages`, `enPause`, `onCapture`, `onImporter`, `onClose`, `Viseur.tsx:29-37`). Capture `08-reprendre-viseur` : identique au viseur normal (« Terminer (2) »). Rien n'indique que la prochaine photo remplacera la page 1.
- A5 (basse) Deux sorties équivalentes dans le viseur : la croix « Fermer le viseur » (`Viseur.tsx:258-268`) et « Terminer (N) » appellent le même `onClose`.
- A6 (basse) La miniature est le seul moyen d'agrandir (`ScannerApp.tsx:207-216`) ; rien ne l'indique (pas d'icône ni de mention), alors que l'aperçu est la seule façon de vérifier le filtre Magique avant export.
- A7 (basse) Recadrage → page suivante de la file : parcours bien tenu (« · 1 autre photo ensuite », capture `01`) ; en revanche aucun repère visuel du résultat entre deux photos (on enchaîne les Valider sans voir la page produite). Acceptable en import groupé.
- Conforme : retour arrière (Échap / retour navigateur), suppression annulable, flash, cibles 44 px. Les défauts de l'audit design 11-12 (export périmé, SegmentedControl Format/Qualité, état « Lecture des photos… », « Réessayer » caméra) sont corrigés dans le code actuel (`ExportPanel.tsx:26-31,100-133`, `ScannerApp.tsx:164-168`, `Viseur.tsx:244-250`).

### Axe B — vocabulaire et gestes
- B1 (moyenne) Phrase d'intro (`ScannerApp.tsx:152`, capture `ecrans/scanner.clair.png`) : « Les pages restent sur cet appareil tant que tu n'appuies pas sur « Enregistrer dans Documents » ». Ce bouton n'existe pas à ce stade (il n'apparaît qu'après « Créer le PDF », en format PDF seulement, `ExportPanel.tsx:155-157`), et Partager / Télécharger sortent aussi les pages de l'appareil sans les effacer. La phrase est inexacte à deux titres et parle d'un écran futur.
- B2 (basse) « Enregistrer » désigne trois gestes différents : « Partager / enregistrer » (feuille native, `ExportPanel.tsx:148`), « Enregistrer dans Documents » (envoi en ligne) et, au GLOSSARY, la validation d'une modification (« Enregistrer: valider la modification d'un élément existant »). Dans Documents, ce que fait le bouton est plutôt « Envoyer dans Documents » ; le libellé interne de l'état en cours le dit déjà (« Envoi vers Documents… », `EnregistrerDansDocuments.tsx:75`).
- B3 (basse) « Valider » sur le recadrage (`EditeurCoins.tsx:200`) : le GLOSSARY met « Valider » en « Avoid » pour Enregistrer. Ici c'est la création d'une page (« Ajouter » selon la charte) ou son remplacement (Reprendre). Pas de collision réelle mais le bouton ne dit pas ce qu'il produit.
- B4 (basse) « Terminer » (viseur) n'a pas d'équivalent dans la charte ; « Fermer » serait l'intitulé neutre (la croix existe déjà). « Terminer (N) » a l'avantage d'afficher le compte : le garder, supprimer plutôt la croix serait l'alternative.
- B5 (basse) Toast de suppression « Page supprimée · Annuler » (capture `11`) : conforme au patron GLOSSARY. Le libellé de la carte « Page N » se renumérote après suppression (`Page ${i + 1}`), sans conséquence.
- B6 (info) « Créer le PDF (N pages) » / « Créer N images » : exception documentée au GLOSSARY (« hors charte »). Pas de proposition.
- Conforme : « Supprimer » écrit en entier, « Annuler » = abandonner la photo, « Vider le brouillon » avec confirmation (patron prévu pour les pertes de brouillon), « brouillon » réservé au scanner/musculation.

### Axe C — cohésion fonctionnelle
- C1 (moyenne) Documents ne propose pas le Scanner, et le Scanner n'envoie qu'un PDF (`EnregistrerDansDocuments` n'est monté que pour `fichiers.length === 1 && application/pdf`, `ExportPanel.tsx:155`). Les pages en images JPEG (format « Images JPEG ») ne peuvent donc pas aller dans Documents, alors que Documents accepte `image/*` (`DocumentForm.tsx:141`, `documents-vrac.ts:33,357-366` : `jpg` ou `pdf`).
- C2 (basse) Le formulaire « Ajouter un document » de Documents offre un sélecteur de fichier mais aucun chemin « Scanner un papier » : pour un papier physique, Vincent doit savoir qu'il faut passer par le menu Plus → Scanner puis revenir. Pas de doublon fonctionnel, juste une porte manquante.
- C3 (basse) Plafond mémoire / lot : documenté et traité à l'audit 11-12 (indicateur de lecture ajouté, chargement toujours en lot, `ScannerApp.tsx:103-115`) : non repris ici.
- C4 (basse) Aucune trace du brouillon hors du module : si Vincent quitte l'écran avec des pages, rien ne le rappelle (pas de pastille sur l'entrée « Scanner » du menu Plus, `registry.ts`). Choix « rien en ligne » respecté : à arbitrer seulement.
- Hors périmètre v1, documenté : réordonner, pivoter, rouvrir le recadrage. Les gestes « Reprendre » (refaire la photo) et « Supprimer » tiennent lieu de correction ; ne pas contredire.
- Aucun doublon de composant détecté : `ConfirmDialog`, `SegmentedControl`, suppression différée partagée avec les autres modules.

## Propositions

- **P1 — Corriger la phrase d'intro (B1).** Remplacer par une formulation exacte et valable dès l'écran vide, p. ex. « Tes pages restent sur cet appareil jusqu'à ce que tu les envoies dans Documents ou les partages. » (ou la placer dans l'état vide). Effet : plus d'allusion à un bouton invisible. Effort S, risque nul. Fichiers : `ScannerApp.tsx`, tests éventuels. Dépend : rien.
- **P2 — Rendre « Vider le brouillon » toujours accessible (A2).** Sortir le bouton de la branche `fichiers` (le placer sous la carte Exporter, ou à côté du titre « Exporter »), en gardant la confirmation actuelle. Effet : repartir de zéro en 2 taps, quel que soit l'état. Effort S ; risque faible (tests `ExportPanel.test.tsx`) ; texte de confirmation à adapter (« Assure-toi d'avoir exporté… » reste valable). Fichier : `ExportPanel.tsx`. Dépend : rien.
- **P3 — Rapprocher Exporter des pages (A1).** Option minimale : liste de pages en vignettes compactes (grille 3 colonnes, miniature + « Page N », Reprendre/Supprimer via la vignette ouverte en aperçu ou icônes), de façon à ce que Exporter reste visible dès 4 à 6 pages. Option légère : bouton fixe « Exporter (N pages) » au-dessus de la barre du bas qui défile jusqu'à la carte. Effet : le geste final reste atteignable ; moins de défilement. Effort M (grille) ou S (bouton). Risque : toucher la zone de tap Reprendre/Supprimer (Reprendre = geste explicitement gardé ; ne pas le retirer) ; ne pas toucher à `ApercuPage`. Fichiers : `ScannerApp.tsx`, (+ `ExportPanel.tsx` pour l'ancre). Dépend : P2 si le bouton Vider bouge.
- **P4 — Ouvrir Documents aux images et raccourcir l'envoi (A3, C1).** (a) Autoriser « Enregistrer dans Documents » aussi pour le format JPEG (boucle sur `preparerUploadsVrac(["image"…])` + `enregistrerDocumentsVrac`, une entrée par page). (b) Libeller l'action « Envoyer dans Documents » (B2). Variante plus ambitieuse : un seul bouton qui génère puis envoie, en gardant « Créer » pour Partager/Télécharger. Effet : toutes les sorties mènent à Documents. Effort M (a) / S (b) ; risque : upload multiple, erreurs partielles, tests `EnregistrerDansDocuments.test.tsx` ; la variante change le patron « génère puis choisis ». Fichiers : `EnregistrerDansDocuments.tsx`, `ExportPanel.tsx`, `src/app/actions/documents-vrac.ts` (inchangé si l'API actuelle suffit). Dépend : décision de Vincent sur (a).
- **P5 — Signaler Reprendre dans le viseur (A4).** Passer `remplacerId` (ou un booléen) à `Viseur` et afficher « Remplace la page N » dans la pastille ou près du déclencheur ; en mode reprise, afficher « Annuler » au lieu de « Terminer (N) » (A5). Effet : l'utilisateur sait ce que fait la prochaine photo. Effort S ; risque faible (props de `Viseur`, tests `ScannerApp`). Fichiers : `Viseur.tsx`, `ScannerApp.tsx`. Dépend : rien.
- **P6 — Libellés à harmoniser (B2, B3, B4).** « Partager / enregistrer » → « Partager » (la feuille native propose d'enregistrer) ; recadrage « Valider » → « Ajouter la page » (ou « Remplacer la page » en reprise) ; indice d'agrandissement sur la miniature (A6, p. ex. mention « Touche la page pour l'agrandir » en bas de liste ou icône loupe). Effort S, risque : tests aria-label (`ExportPanel.test.tsx`, `EditeurCoins.test.tsx`). À trancher par Vincent : « Terminer » vs « Fermer ». Fichiers : `ExportPanel.tsx`, `EditeurCoins.tsx`, `ScannerApp.tsx`. Dépend : rien.

À ne pas faire (déjà tranché) : réordonner, pivoter, rouvrir le recadrage (v1) ; renommer « Créer le PDF » (hors charte volontaire) ; envoyer le scan en ligne sans geste explicite ; choix de filtre (un seul filtre « Magique »).

## Pistes inter-modules
- Documents : ajouter un chemin « Scanner un papier » dans l'écran ou le formulaire d'ajout de document (lien vers `/scanner`), et, au retour, ouvrir `/documents?vrac=1` (déjà le cas depuis le toast « Voir dans Documents »).
- Menu Plus / Aujourd'hui : un brouillon non vide pourrait s'afficher en pastille sur l'entrée Scanner (module Navigation) ; à arbitrer, car ce serait le premier état « en cours » local exposé hors du module.
- GLOSSARY : documenter « Envoyer dans Documents » si P4/P6 sont retenus, et la place de « Terminer » / « Reprendre ».
- Console du banc : `/vendor/opencv.js` renvoie 404 (HTML) au chargement du viseur/import (voir plus bas) ; à vérifier côté déploiement (hors périmètre écran).

## Ce qui n'a pas pu être testé
- Banc : caméra remplacée par le flux factice de Chromium (cadre vert, aucune détection possible : pastille restée sur « Cherche la feuille… », capture `09`) ; le comportement réel du viseur (permission, flux coupé, mise en veille, flash) est jugé d'après le code et l'audit 11-12. Détection automatique : fonctionne sur une photo synthétique simple (`01`), non jugée sur de vraies photos.
- Partage natif (Web Share) indisponible : seul « Télécharger » visible (`06`) ; « Partager » lu dans le code. Téléchargement du fichier non vérifié.
- « Enregistrer dans Documents » : non exécuté (faux Supabase sans Storage/URL signée) ; lu dans le code.
- IndexedDB : fonctionne sur le banc (rechargement `07` conserve les pages), mais quota / navigation privée / mémoire sur gros lots non testés.
- Gestes tactiles fins (déplacement de coin avec loupe, pincement, double-toucher) non simulés.
- Bruit du banc, pas des bugs : 404 `/_vercel/speed-insights/script.js` ; 404 `/vendor/opencv.js` (fichier absent du banc : le module `opencv.ts` le charge à la demande, à confirmer sur déploiement) ; barre du bas avec onglet « Plus » surligné (préférences du faux Supabase).

## Résumé final
- Parcours Scanner → recadrage → pages → export sain et sans bug sur le banc ; défauts du 11-12 déjà corrigés.
- Points à corriger : intro inexacte (B1), « Vider » caché avant export (A2), Exporter éloigné d'une liste de grandes cartes (A1), Reprendre non signalé dans le viseur (A4).
- Cohésion Documents : envoi limité au PDF, pas de porte d'entrée depuis Documents (C1, C2).
- 6 propositions P1-P6 (3 en S, 2 en S/M, 1 en M), aucune ne touche aux choix documentés (pas de réordonner/pivoter, « Créer le PDF » hors charte).
- Rapport : `/home/user/Kilio/reports/refonte-modules/scanner.md` ; captures `/home/user/Kilio/reports/audit/scanner/`.
