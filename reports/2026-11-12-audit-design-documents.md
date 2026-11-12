# Audit design : module Documents (2026-11-12)

Périmètre : `src/app/(app)/documents/**` (liste, fiche `[id]`, `categories`, modales Description / Trier le vrac / Réorganiser) et les composants partagés `Modal`, `ImageLightbox`, `lib/documents/partage.ts`. Lecture seule, aucun rendu navigateur : tailles de cibles déduites des classes. Grille du brief (conformité, parcours, finitions), axes : Purpose, Audience, Tone, Memorable detail, Constraints.

## Résumé

- Le geste le plus fréquent (ajouter un document en photo) a un défaut de fond : une 2e prise de photo remplace la 1re, et l'envoi sans fichier échoue sans message.
- La liste est lisible mais l'identification et l'ouverture d'un document sont fragiles : noms tronqués à côté de la pastille, seule la ligne du nom ouvre la fiche (cible d'environ 22 px).
- Le reste est du détail (a11y des modales d'IA, libellés, `tabular-nums`) ; la base (focus des modales, annulations, `runAction` en liste) est saine.

## Critique

### C1. Ajouter des photos en plusieurs prises : chaque sélection remplace la précédente
- `DocumentForm.tsx:259-261` (`handleFilesChange` : `setSelectedFiles(Array.from(e.target.files))`), `:409-419`.
- Scénario : j'ouvre « Ajouter un document », je prends la page 1 avec l'appareil photo, puis je touche « + » pour la page 2. L'input `multiple` renvoie uniquement la nouvelle sélection : la vignette de la page 1 disparaît sans message. Annuler le sélecteur de fichiers peut aussi vider la sélection (comportement de Chrome, à confirmer au rendu). Seule une sélection multiple faite d'un coup dans la galerie fonctionne.
- Axe : Memorable detail (prise de photo de document, geste le plus fréquent) et Purpose.
- Correctif : fusionner la nouvelle sélection avec l'existante (ajouter à `selectedFiles`, reconstruire le `FileList` par `DataTransfer` comme `removeSelectedFile` le fait déjà `:263-272`), ignorer un `change` vide.
- Correctif sûr : non (comportement du formulaire, à valider avec Vincent ; aucun impact schéma).

## Important

### I1. « Ajouter le document » sans fichier : aucun message, aucune soumission
- `DocumentForm.tsx:409-419` (`required={aucunFichier}` sur un input `className="hidden"`, donc `display: none`) ; même motif `:136-144` (Recto / Verso).
- Scénario : j'ai rempli le nom, oublié la photo, je touche « Ajouter le document ». Chrome ne peut pas afficher la bulle de validation d'un champ requis non focalisable : la soumission est bloquée en silence (« An invalid form control is not focusable »). Le bouton ne réagit pas. Les mêmes inputs masqués ne sont pas atteignables au clavier (`<label>` non focalisable), WCAG 2.1.1.
- Axe : Memorable detail (retour visuel du geste principal) et Tone (rien n'explique l'échec).
- Correctif : remplacer `hidden` par `sr-only` (champ focalisable, bulle native visible) avec un anneau de focus porté par le `<label>` (`peer-focus-visible:ring-2 ring-kcal`) ; ou valider à la main et afficher « Ajoute au moins un fichier. » via le `<p role="alert">` existant.
- Correctif sûr : oui (classe CSS seule). La validation manuelle est aussi sûre.

### I2. Seule la ligne du nom ouvre la fiche : cible d'environ 22 px de haut
- `DocumentCard.tsx:139-147` (`TransitionLink` en `flex-1`, centré verticalement à côté d'une vignette de 56 px).
- Scénario : une main, je touche la carte (sous le nom, à droite de la pastille, sur le vide) pour consulter un document : rien ne se passe. Il faut viser le texte du nom (hauteur d'une ligne).
- Axe : Memorable detail (consulter en quelques secondes, une main) et Audience (mémoire musculaire : ailleurs, la carte entière est la cible).
- Correctif : étirer le lien (`self-stretch` sur le lien et `items-stretch` sur la rangée), ou lien étendu par `after:absolute after:inset-0` avec les boutons de la carte en `relative z-10`.
- Correctif sûr : oui (zone de tap seulement ; vérifier que la vignette et les actions restent au-dessus).

### I3. Noms de documents tronqués (liste) ou écrasés (fiche)
- Liste : `DocumentCard.tsx:141` (`nameText` = `truncate`) partage la ligne avec la pastille de catégorie (`:143`). Sur 360 px il reste environ 150 px au nom. Fiche : `DocumentDetail.tsx:101-113` : `h1 truncate` à côté d'un bloc `shrink-0` de 4 boutons (≈ 230 px) laisse environ 100 px au titre, illisible, sans moyen de le voir en entier.
- Scénario : « Attestation d'assurance habitation » et « …véhicule » s'affichent tous deux « Attestation d'assur… ». Le commentaire de `ui.ts` (`nameTextComplet`) cite exactement ce cas.
- Axe : Purpose (reconnaître le bon document d'un coup d'œil) et Constraints (le composant `nameTextComplet` existe).
- Correctif : liste : `nameTextComplet` avec `min-w-0`, pastille sous le nom (`flex-wrap`). Fiche : titre pleine largeur, rangée d'actions dessous (`actionsLigne`) et `h1` sans `truncate` (`break-words`, `text-balance`).
- Correctif sûr : oui (affichage seul ; hauteur de carte variable).

### I4. Entrée au clavier dans la recherche = appel Gemini
- `DocumentsBrowser.tsx:284-291` (`onSubmit` → `chercherAvecIa()`), `:294` (`enterKeyHint="search"`).
- Scénario : je tape « passeport » et je touche Entrée / Rechercher pour fermer le clavier : un appel IA part (latence de plusieurs secondes, quota Gemini non plafonné, voir audit global), et la liste filtrée instantanément est remplacée par une « Sélection de l'IA » `:334-349`. Hors ligne : message d'erreur au lieu d'un simple filtre. Le bouton explicite « Chercher avec l'IA » existe déjà `:315-326`.
- Axe : Memorable detail (recherche rapide) et Tone (action coûteuse déclenchée sans l'avoir demandée).
- Correctif : Entrée ne fait que `blur()` sur le champ ; l'IA part seulement par le bouton dédié. Si le placeholder « poser une question » est voulu, garder Entrée pour les phrases (plus de 3 mots) uniquement.
- Correctif sûr : non (choix produit sur le comportement de la touche Entrée).

### I5. « Annuler » du formulaire d'ajout : cible d'environ 20 px, composant maison
- `AddDocumentToggle.tsx:35-37` (`mt-2 text-sm text-ink-2 underline`, sans `min-h-11` ni anneau de focus).
- Scénario : je referme le formulaire d'ajout d'un tap pouce ; la zone fait la hauteur d'une ligne de 14 px. Les deux autres « Annuler » du module (`DocumentCard.tsx:150`, `DocumentDetail.tsx:90`) utilisent `textButton` (44 px, anneau de focus).
- Axe : Constraints (composant `textButton` existant, cible 44 px) et Audience.
- Correctif : `className={textButton}`.
- Correctif sûr : oui.

### I6. Suppression depuis la fiche : message d'erreur brut, en bas de page, sans annonce
- `DocumentDetail.tsx:122-136` (appel direct à `deleteDocument`, `setError(e.message)`), `:232` (`<p className={errorText}>` sans `role="alert"`).
- Scénario : hors ligne (ou erreur Storage), je supprime un document depuis la fiche. En production Next masque le message serveur et le réseau renvoie « Failed to fetch » : une phrase anglaise technique s'affiche sous les images, souvent hors de l'écran, non annoncée. La liste fait mieux (`DocumentCard.tsx:158-163` : `runAction`, toast en français, `MESSAGE_HORS_LIGNE`). `runAction` relance déjà `isRedirectError` (`runAction.ts:51`), le garde-fou CLICK-PATH-701 reste donc respecté.
- Axe : Tone (calme, en français) et Constraints (contrat T1, `runAction`).
- Correctif : `await runAction(() => deleteDocument(document.id), { erreur: "Le document « … » n'a pas pu être supprimé. Réessaie." })` dans la transition, supprimer `error` pour ce cas, et ajouter `role="alert"` à l'erreur de partage restante.
- Correctif sûr : oui.

## Mineur

- **M1. `aria-busy` sur l'ancêtre d'une zone `aria-live`** : `TriVracModal.tsx:203` (compteur `:205`) et `ReorganiserModal.tsx:219` (`:220`). `aria-busy="true"` demande aux lecteurs d'écran de ne rien annoncer dans le sous-arbre : la progression n'est pas lue. Axe : Purpose / a11y. Correctif : retirer `aria-busy` du conteneur (le garder sur la région vivante seule). Sûr : oui.
- **M2. Compteur sans `tabular-nums`, coche non nommée** : `TriVracModal.tsx:206` (`{analyses} / {lot.length}` bouge de largeur à chaque document) ; `:230` (`aria-label="Analysé"` sur un `<span>` sans rôle, ignoré par les lecteurs d'écran). Axe : finitions (make-interfaces-feel-better n°5). Correctif : `tabular-nums` ; texte `sr-only` « Analysé » à la place de l'`aria-label`. Sûr : oui.
- **M3. « 2 doc.s »** : `ReorganiserModal.tsx:289` `pluriel(ids.length, "doc.")` produit « doc.s » au pluriel (`pluriel` ajoute un « s »). Axe : Tone / finition. Correctif : `pluriel(n, "doc.", "doc.")`. Sûr : oui.
- **M4. « Voir les documents » ne ressemble pas à un bouton** : `ReorganiserModal.tsx:308` (marqueur `<details>` masqué, aucun chevron). Axe : Audience / lisibilité d'état. Correctif : chevron qui pivote (`group-open:rotate-90`, transition `transform` explicite). Sûr : oui.
- **M5. Boutons et liens identiques sur la fiche** : `DocumentDetail.tsx:163` (chaque image : « Agrandir l'image », le Recto et le Verso ne se distinguent pas), `:178-203` (plusieurs « Ouvrir le PDF » sans nom propre, `target="_blank"` non annoncé). Axe : a11y (WCAG 2.4.4). Correctif : `aria-label` avec `caption` ou rang (« Agrandir le recto », « Ouvrir le PDF 2 sur 3 »). Sûr : oui.
- **M6. Téléchargement du lightbox au nom d'un UUID** : `ImageLightbox.tsx:39-40` (nom = dernier segment de l'URL Storage), alors que « Télécharger » de la fiche produit « Mutuelle 2026 - recto.jpg » (`partage.ts:25`). Axe : Purpose / cohérence. Correctif : prop optionnelle `nomFichier` passée par `DocumentCard.tsx:157` et `DocumentDetail.tsx:235`. Sûr : oui (prop facultative, défaut inchangé pour les autres modules).
- **M7. Icônes SVG sans `aria-hidden`** : `DocumentCard.tsx:34-36`, `DocumentDetail.tsx:16-23`, `DocumentForm.tsx:40-47,50-57` (`FichierIcon`, `PdfIcon`). Même motif que M2 de l'audit global ; ici les icônes sont dans des liens ou boutons déjà nommés. Axe : a11y. Correctif : `aria-hidden="true"`. Sûr : oui.
- **M8. « Éditer » (fiche) contre « Modifier » (carte, catégories)** : `DocumentDetail.tsx:117` / `DocumentCard.tsx:152` / `CategoriesManager.tsx:231`. Axe : Audience (mémoire musculaire, un seul mot par action). Correctif : « Modifier » partout. Sûr : oui (les tests qui cherchent « Éditer » sont à ajuster).
- **M9. Focus perdu après « Chercher avec l'IA »** : `DocumentsBrowser.tsx:315` : le bouton disparaît quand `ia.question === search.trim()`, alors qu'il a le focus. Axe : a11y (WCAG 2.4.3). Correctif : déplacer le focus sur le bandeau `role="status"` (`tabIndex={-1}`). Sûr : oui.
- **M10. « Appliquer » grisé sans raison affichée** : `TriVracModal.tsx:167,356` (nom vidé = bouton désactivé), `aria-invalid` posé `:315` mais aucun style ni texte (rien dans `globals.css`). Axe : Tone (pas de jugement, mais pas de mystère). Correctif : ligne d'aide « Un nom est vide. » sous la liste ou bordure `border-alert` pilotée par `aria-invalid`. Sûr : oui.
- **M11. Fermer par la croix ou le fond pendant « Application… »** : `TriVracModal.tsx:201` et `ReorganiserModal.tsx:180` (`onClose` actif alors que « Annuler » est désactivé). Si l'application échoue ensuite, l'erreur est écrite dans un composant démonté (mode `silencieux`) : plus de message. Même motif que I-5 de l'audit du 2026-11-07. Axe : Tone / Memorable detail (état final incohérent). Correctif : `onClose` neutre tant que `etape === "application"`, ou toast d'erreur si démonté. Sûr : oui.
- **M12. Cases natives au lieu de `CheckToggle`** : `TriVracModal.tsx:271`, `ReorganiserModal.tsx:54,332`. Axe : Constraints (composant existant). Correctif : `CheckToggle` (zone de tap déjà 44 px). Sûr : non (rendu visuel, état indéterminé à reproduire).
- **M13. Liste reconstruite à chaque frappe** : `DocumentsBrowser.tsx:379` (la clé inclut `normalizeSearch(search)`). Contournement documenté d'un bug Cache Components, mais chaque lettre démonte et remonte toutes les cartes et vignettes (scintillement, coût sur téléphone avec beaucoup de documents). Axe : Purpose (recherche fluide). Correctif : ne reconstruire que pour le changement d'onglet / de catégorie / d'IA, et utiliser `layout` pour la frappe ; à tester au rendu. Sûr : non.
- **M14. Retour sous le titre sur Catégories, au-dessus sur la fiche** : `categories/page.tsx:304-306` contre `DocumentDetail.tsx:99`. Axe : Constraints / cohérence interne. Correctif : aligner sur la position des autres écrans de détail. Sûr : oui.

## Options structurantes (non appliquées)

1. **Carte de liste plus légère** : carte entière = lien vers la fiche ; « Modifier », « Suppr. », « Remettre en vrac » et « Description IA » passent dans la fiche ou un menu « ⋯ » (4 boutons par carte aujourd'hui, `DocumentCard.tsx:148-172`). Gain : moins de risque de mauvais tap sur « Suppr. », liste plus calme (Tone). Coût : navigation et gestes à revoir.
2. **Partage au premier tap** : précharger les fichiers à l'ouverture de la fiche (le partage natif exige un geste récent ; la première tentative après un `fetch` lent échoue avec « Le partage a expiré », `DocumentDetail.tsx:73-74`). Axe : Memorable detail. Demande une stratégie réseau (taille, mémoire).
3. **Ajout orienté photo** : fichiers en premier, nom prérempli (date ou nom du fichier), accumulation de prises (C1) ; file d'attente Dexie pour ajouter un document hors ligne (aujourd'hui : « Pas de connexion : rien n'a été enregistré », la photo est perdue si l'on ferme). Doit passer par `lib/offline/queue.ts` (Constraints).
4. **Visionneuse de document** : glisser entre recto / verso / pages, zoom au pincement, PDF lu dans l'app plutôt que `target="_blank"` hors de la PWA (`DocumentCard.tsx:120`, `DocumentDetail.tsx:178`). Aujourd'hui le lightbox s'ouvre sur une seule image sans zoom dédié.
5. **Fermeture des modales d'IA avec saisie** : voir I3 de l'audit global ; ici, prévoir une confirmation si des propositions ont été éditées (Trier le vrac, Réorganiser).

## Déjà couvert par l'audit du 2026-11-07 (non refait)

- **I3 (`Modal.tsx:40`, fermeture au tap sur le fond)** : valable pour `ReorganiserModal` (cité) et, à l'identique, pour `TriVracModal` à l'étape d'aperçu `TriVracModal.tsx:201` (non cité dans la liste de I3 : à ajouter à son périmètre, les propositions éditées sont perdues et les documents décochés sont marqués « ignorés » par `fermer`, `:169-174`). `DescriptionModal` n'a pas de saisie : sans enjeu.
- **M-13 (modales sans `useBackClose`)** : `documents/*Modal.tsx` y figure déjà ; `ImageLightbox` et `AddDocumentToggle` utilisent bien `useBackClose`.
- **I-5 (fermer l'aperçu pendant l'application)** : motif repris en M11 pour les deux modales du module.
- **I1 « à vérifier » `documents/DocumentsBrowser.tsx:~295`** : faux positif, le champ porte `aria-label="Rechercher un document"` (`:296`) et le `<select>` aussi (`:304`).
- **M5 (cibles des pastilles)** : boutons icône du module (`BoutonDescription`, `BoutonRemettreEnVrac`, 36 px + `after:-inset-1` = 44 px) et pastilles de filtre (`zoneTapPill`) vérifiés conformes.
- **M7 (écrans plein écran)** : `ImageLightbox` utilise bien `useDialogFocus` (`:29`).
- **Limiteur Gemini non persistant, boucles d'UPDATE séquentielles (`documents-vrac.ts:304-325`), `eslint-disable` de `DescriptionModal.tsx:~67` et `TriVracModal.tsx:~150`** : constats serveur / code, hors design.

## Points vérifiés sans constat

Rayons (cartes 20 px, vignettes 12-16 px), contours `border-line` sur les vignettes, aucun `transition-all`, `Modal` (focus, Échap, `aria-labelledby`), annulation de la suppression d'un fichier (`supprimerAvecAnnulation`) et de « Remettre en vrac » (`remettreEnVrac.ts`), états vides, skeletons `loading.tsx`, `prefers-reduced-motion` (`motion-safe:animate-*`).
