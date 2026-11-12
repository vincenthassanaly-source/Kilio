# Audit design du module Collection (2026-11-12)

Lecture seule, trois passes de la grille (conformité/accessibilité, parcours, finitions) selon `reports/2026-11-12-brief-design.md`. Périmètre : `src/app/(app)/collection/**` (dont `[id]`), `ImageLightbox`, `FadeInImage`, `GridSkeleton` ; `VideoFeed` et `src/app/actions/collections.ts` lus pour les scénarios. Aucun lancement de build, lint ou test.

## Résumé

- Module globalement solide : suppression différée avec « Annuler », cibles de 44 px sur les pastilles de `PhotosGrid`, lightbox avec focus piégé, mouvement réduit couvert globalement, modales d'IA en deux temps (aperçu puis « Appliquer »).
- Les écarts viennent surtout des chemins d'erreur (messages d'exception brute, erreur périmée qui masque la suivante) et du geste le plus fréquent (ajout de photos), suivi d'une fenêtre IA qui s'ouvre d'elle-même.
- 0 critique, 4 importants, 10 mineurs, 3 options structurantes.

## Critique

Aucun.

## Important

### I1. Rename, suppression de collection et ajout de lien vidéo affichent le message d'exception brut
- Fichiers : `collection/[id]/CollectionHeader.tsx:38-40` et `:53-55` ; `collection/[id]/AddPhotoButton.tsx:141-143`. Les actions `renameCollection`, `deleteCollection` et `ajouterLienVideo` lèvent des `Error` (`src/app/actions/collections.ts:214-244`, `:282-311`).
- Scénario : en production Next masque le message d'une exception de Server Action, et hors ligne le message est celui du `fetch`. Vincent colle un lien TikTok invalide, ou renomme une collection dans le métro : il lit un texte technique générique (« An error occurred… » ou « Failed to fetch ») au lieu de « Lien invalide » ou « Pas de connexion ». `AddPhotoButton.handleFiles` applique déjà le contrat T1 (`estErreurReseau` + message lisible, lignes 115-119), pas ses voisins.
- Axe violé : Audience (usage parfois hors ligne, expert pressé qui doit comprendre l'échec d'un coup d'œil) et Memorable detail (retour visuel de l'ajout).
- Correctif : passer rename et delete par `runAction(..., { erreur, silencieux: true })` avec un message de repli et `MESSAGE_HORS_LIGNE`. Pour le lien vidéo, convertir `ajouterLienVideo` en `ActionResult` afin de conserver « Lien TikTok ou YouTube invalide ».
- Correctif sûr : oui pour rename et delete ; non pour `ajouterLienVideo` (contrat serveur).

### I2. Une erreur de photo périmée masque l'erreur (ou le succès) du lien vidéo
- Fichier : `collection/[id]/AddPhotoButton.tsx:212-216` (`{error ?? videoError}`), `:91` et `:133` (chacun n'efface que son propre état).
- Scénario (état final incohérent) : envoi de photos échoué hors ligne, « Pas de connexion… » s'affiche. Retour en ligne, Vincent ajoute un lien vidéo qui échoue : `error` est encore posé, donc l'alerte reste celle des photos et le vrai motif n'apparaît jamais. Même si l'ajout du lien réussit, l'ancienne erreur reste affichée à côté d'un ajout réussi.
- Axe violé : Memorable detail (retour visuel du geste d'ajout).
- Correctif : `setError(null)` au début de `handleAjouterVideo` et `setVideoError(null)` au début de `handleFiles`.
- Correctif sûr : oui.

### I3. La fenêtre « Décrire » s'ouvre seule après chaque ajout et lance Gemini sans confirmation
- Fichiers : `collection/[id]/CollectionDetailView.tsx:36-41` (`ouvrirTitrage`), appelé par `AddPhotoButton.tsx:111` et `:140` ; `TitrageModal.tsx:72-134` (l'analyse démarre dès le montage).
- Scénario : Vincent ajoute 3 photos d'une main. Dès la fin de l'envoi, une modale plein écran s'ouvre et consomme du quota Gemini (jusqu'à 70 s par paquet). Il doit appuyer sur « Arrêter » pour revenir à sa grille. Le lot contient aussi d'anciens éléments sans description, pas seulement les nouveaux.
- Axe violé : Purpose (geste rapide, sans quitter le flux) et Memorable detail (le geste d'ajout doit se terminer proprement) ; Tone (interruption).
- Correctif proposé : ne plus ouvrir la modale automatiquement ; s'appuyer sur la bannière « N éléments sans description » (qui existe déjà, `CollectionDetailView.tsx:77-96`) ou la mettre en évidence après l'ajout.
- Correctif sûr : non (changement de comportement, décision produit).

### I4. Un échec de rechargement efface la grille déjà affichée
- Fichiers : `collection/CollectionsGrid.tsx:81-87` (`isLoading ? … : isError ? ErrorInline …`) ; `collection/[id]/CollectionDetailView.tsx:55-65` (`isError || !collection`).
- Scénario : les collections sont affichées, Vincent tire pour rafraîchir ou revient dans l'app avec un réseau instable. En TanStack Query v5, un refetch en échec passe `status` à `error` tout en gardant `data` : la grille et le détail sont remplacés par « Impossible de charger » alors que les données récentes sont en mémoire. Le correctif est local ; hors ligne franc, la requête est seulement en pause, le défaut touche donc surtout le réseau dégradé.
- Axe violé : Audience (usage mobile, parfois hors ligne ou réseau faible) ; Memorable detail (consulter en quelques secondes).
- Correctif : n'afficher l'erreur que si aucune donnée n'est disponible (`isError && !collections`), sinon garder la grille et signaler l'échec par un toast.
- Correctif sûr : oui.

## Mineur

### M1. Le renommage garde le brouillon précédent et peut écraser un nom changé ailleurs
- Fichier : `collection/[id]/CollectionHeader.tsx:18` (`useState(collection.nom)` jamais resynchronisé) et `:87`.
- Scénario : Vincent tape un nom, ferme avec le geste retour (`useBackClose`, ligne 24), rouvre « Renommer » : le brouillon est toujours là. Plus gênant : « Réorganiser » (Gemini) renomme la collection, puis un « OK » sur l'ancien état remet le vieux nom sans que Vincent s'en rende compte.
- Axe violé : Purpose (saisie rapide et fiable).
- Correctif : `setNom(collection.nom)` dans le handler qui ouvre l'édition.
- Correctif sûr : oui. Voir aussi le champ sans `aria-label` (`:66`), déjà cité par l'audit du 2026-11-07.

### M2. Bouton « Suppr. » abrégé et sans nom accessible complet
- Fichier : `collection/[id]/CollectionHeader.tsx:91-93`.
- Scénario : la seule action destructive de l'écran, collée à « Renommer », est abrégée (« Suppr. ») ; un lecteur d'écran n'annonce pas ce qu'elle supprime. La confirmation évite l'accident, le libellé reste abrupt.
- Axe violé : Tone (clair, calme, sans abréviation sèche).
- Correctif : `aria-label="Supprimer la collection"`, texte visible « Supprimer » si la largeur le permet (le titre porte déjà `truncate`).
- Correctif sûr : oui.

### M3. Échec de copie du lien : pastille « ✕ » identique au bouton Supprimer, sans message visible
- Fichier : `collection/[id]/CopierLienVideoButton.tsx:51-52` (glyphe croix), `:62-64` (texte réservé aux lecteurs d'écran).
- Scénario : la copie échoue (presse-papiers refusé). Pendant 2 s la pastille en haut à gauche affiche la même croix que la pastille de suppression en haut à droite : à lire comme « supprimer » ou « fermer », pas comme une erreur. Aucun texte visible.
- Axe violé : Memorable detail (retour visuel du geste).
- Correctif : glyphe d'alerte distinct, ou `showErrorToast("Copie impossible")` ; un toast « Lien copié » en cas de succès serait cohérent avec le reste de l'app.
- Correctif sûr : oui.

### M4. Le décalage d'entrée de la grille s'applique aussi à la sortie et au réagencement
- Fichier : `collection/[id]/PhotosGrid.tsx:139-147` (`transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.3) }}` s'applique à `animate`, `exit` et `layout`).
- Scénario : sur une grille de 20 photos, supprimer la 15e retarde la disparition de 0,3 s et fait glisser les voisines en différé. Le geste de suppression paraît mou.
- Axe violé : Tone (animations discrètes, qui accompagnent le geste) ; reprend la règle 9 de `make-interfaces-feel-better`.
- Correctif : réserver le délai à `animate` initial (`transition` dans `animate`, `exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18, delay: 0 } }}`).
- Correctif sûr : oui.

### M5. Libellés des tuiles : « photos » pour des vidéos, nom tronqué sur une ligne
- Fichiers : `collection/CollectionsGrid.tsx:42-44` (`{nb_photos} photo(s)`) et `:39` (`nameText` = `truncate`) ; `collection/[id]/PhotosGrid.tsx:124` (« Aucune photo pour l'instant ») ; `collection/[id]/CollectionHeader.tsx:79` (`truncate`).
- Scénario : une collection de liens TikTok affiche « 12 photos » ; deux classeurs aux noms proches (« Recettes d'été… ») deviennent indiscernables une fois tronqués dans une colonne de moitié d'écran.
- Axe violé : Purpose (se repérer en quelques secondes) ; Tone (vocabulaire exact).
- Correctif : « élément(s) » (à vérifier dans `GLOSSARY.md`), `line-clamp-2 text-balance` sur le nom de tuile.
- Correctif sûr : oui.

### M6. La bannière « N éléments sans description » est un rappel permanent, sans moyen de la mettre de côté
- Fichier : `collection/[id]/CollectionDetailView.tsx:77-96`.
- Scénario : chaque ouverture d'un classeur rappelle ce qui « manque », sans fin possible si Vincent ne veut pas décrire certaines vidéos. Le ton tient du retard à rattraper.
- Axe violé : Tone (« jamais de vocabulaire de retard ») ; Purpose.
- Correctif : formulation neutre (« Décrire N éléments avec l'IA ») et masquage mémorisé par classeur (`localStorage`, avec try/catch).
- Correctif sûr : non (nouveau comportement de masquage). La reformulation seule est sûre.

### M7. « Annuler » du formulaire de création : cible d'environ 20 px, sans anneau de focus du design system
- Fichier : `collection/AddCollectionToggle.tsx:54` (`text-sm text-ink-2 underline`).
- Scénario : à une main, le lien est difficile à toucher, juste à côté du bouton « Créer ». `textButton` (`src/lib/ui.ts`, 44 px de haut) existe précisément pour « Annuler sous un formulaire ».
- Axe violé : Constraints (composant existant ignoré) et Memorable detail (ajout rapide).
- Correctif : `className={textButton}`.
- Correctif sûr : oui. (`aria-label` du champ `nom` à la ligne 42 : déjà cité par l'audit du 2026-11-07.)

### M8. Zone d'ajout : accessibilité clavier et cohérence des panneaux
- Fichier : `collection/[id]/AddPhotoButton.tsx:150-179` et `:183-209`.
- Constats : (a) les `<input type="file">` ont `className="hidden"` (`display: none`) et les boutons sont des `<label>` : ils ne sont pas atteignables au clavier ni par un lecteur d'écran (WCAG 2.1.1) ; (b) pendant l'envoi, les deux libellés affichent le même texte « Compression… » / « Envoi 1/2… » en double ; (c) le formulaire du lien n'a ni `useBackClose` (contrairement à `AddCollectionToggle.tsx:15`) ni `aria-expanded` sur « Lien vidéo », et son bouton devient « … » (nom accessible vide) pendant l'envoi.
- Axe violé : Memorable detail (le geste de prise de photo doit être irréprochable) ; Constraints (patron `useBackClose` des panneaux).
- Correctif : inputs `sr-only` focusables avec anneau sur le label (`peer` / `has-[:focus-visible]`), texte de progression sur un seul bouton, `aria-label="Ajouter la vidéo"` sur « OK », `useBackClose(videoOpen, …)` et `aria-expanded`.
- Correctif sûr : oui pour (a) à (c) pris un à un (aucun effet sur les données). Les modales de la collection sans entrée d'historique sont déjà couvertes par M-13 de l'audit du 2026-11-07.

### M9. « Arrêter » pendant l'analyse jette les résultats déjà obtenus
- Fichier : `collection/[id]/TitrageModal.tsx:143-146` (`fermer` pose `arret` et ferme) et `:209-211`.
- Scénario : sur un lot de 12 éléments, Vincent arrête après 8 analyses : tout est perdu, le quota Gemini déjà consommé n'a servi à rien. Il peut seulement relancer.
- Axe violé : Purpose (effort et quota déjà investis) ; Tone.
- Correctif : « Arrêter » passe à l'étape aperçu avec les lignes déjà analysées.
- Correctif sûr : non (changement de comportement).

### M10. Finitions diverses
- `collection/[id]/CollectionDetailView.tsx:90` : `secondaryButton` (`rounded-2xl`, 16 px) dans une bannière `rounded-2xl` avec 10 à 14 px de marge : rayon non concentrique. Plancher DESIGN de 12 px : utiliser `rounded-xl`.
- `collection/[id]/TitrageModal.tsx:178` : compteur « {analyses} / {lot.length} » qui change dans le temps sans `tabular-nums` (le texte saute à chaque paquet). `ReorganiserCollectionsModal.tsx:311` et `:368` l'appliquent déjà.
- `collection/[id]/TitrageModal.tsx:202` : `aria-label="Analysé"` sur un `<span>` générique, non annoncé par les lecteurs d'écran. Utiliser `<span className="sr-only">Analysé</span>` avec le « ✓ » en `aria-hidden`.
- `collection/CollectionMosaic.tsx:26` : l'état vide n'a pas le `border border-line` des quatre autres variantes (lignes 34, 50, 70, 109) : le carré gris sans contour jure avec les tuiles voisines.
- Axes violés : Constraints (tokens et rayons de `DESIGN.md`), Tone. Correctifs sûrs : oui.

## Options structurantes (non appliquées, décision à prendre)

- **O1. Lightbox photo avec navigation.** `ImageLightbox` n'affiche qu'une seule image : pour passer à la suivante il faut fermer, puis rouvrir, alors que `VideoFeed` enchaîne déjà les vidéos du classeur. Proposer précédent/suivant et glissement latéral (et pincer pour zoomer) sur les photos. Touche un composant partagé (Documents l'utilise aussi) : à valider. Axe : Purpose (consulter en quelques secondes), Memorable detail.
- **O2. Rendre visibles le titre et la description.** La fenêtre « Décrire » demande à Vincent de relire des titres et des descriptions, mais ni `PhotosGrid` ni la lightbox ne les affichent (seul `VideoFeed.tsx:161` s'en sert, en `aria-label`). Ils ne servent qu'à « Réorganiser ». Afficher le titre sous la tuile ou dans la lightbox donnerait un retour concret à l'effort. Axe : Purpose.
- **O3. Emplacement des actions rares.** « Réorganiser » (occasionnel) occupe la première position sous la carte « Nouvelle collection » (`CollectionsGrid.tsx:69-79`), et la pastille de suppression est présente en permanence sur chaque vignette (`PhotosGrid.tsx:177-188`, atténuée par le toast « Annuler » de 6 s). Les replier dans un menu « … », une sélection multiple ou un appui long libérerait la grille, au prix d'un nouveau motif d'interaction. Axe : Purpose, Tone.

## Déjà couvert par l'audit du 2026-11-07 (non refait)

- I1 (performances) : `getCollectionsAvecApercu` charge toutes les photos pour n'en garder que 4 (`src/app/actions/collections.ts:135-151`).
- I4 (sécurité) : actions Gemini sans limite de débit (`collection-rangement.ts`, `collection-reorganisation.ts`, `collection-titrage.ts`) ; M2 : boucles d'`UPDATE` séquentielles de `collection-titrage.ts:131-146` et `collection-reorganisation.ts:404-416`.
- M2 (sécurité) : route de partage `src/app/collection/partage/route.ts` (hors de ce périmètre).
- Champs de saisie sans `aria-label` : `AddCollectionToggle.tsx:42`, `CollectionHeader.tsx:66`, `TitrageModal.tsx:260,269` (cités « à vérifier » dans l'audit d'accessibilité).
- M5 (accessibilité) : cibles des vignettes de `PhotosGrid:183` et `CopierLienVideoButton:47`. Vérifié ici : les boutons englobants font bien `h-11 w-11` (44 px), le point peut être clos.
- M-13 (parcours) : `collection/*Modal.tsx` sans entrée d'historique (`useBackClose` absent de `Modal`) ; M3 (performances) : `VideoFeed.tsx:169` sans `loading="lazy"`.
- Fallbacks `[]` et `catch(() => {})` dans `lib/collection/*` et `collection/partage/choisir/*` (audit qualité).
- Nouveaux (non couverts) : I1 à I4 et M1 à M10 de ce rapport.
