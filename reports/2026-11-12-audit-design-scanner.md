# Audit design du module Scanner (2026-11-12)

Lecture seule, trois passes de la grille (conformité/a11y, parcours, finitions). Périmètre : `src/app/(app)/scanner/*` (ScannerApp, Viseur, EditeurCoins, ApercuPage, ExportPanel), plus `useDialogFocus`, `useBackClose`, `suppressionDifferee`, `lib/scanner/brouillon|partage` pour la logique d'état. Rien n'a été exécuté ni mesuré au rendu : les constats sur l'appareil (caméra, arrière-plan, historique) sont à confirmer sur téléphone.

## Résumé

- Base solide : trois overlays avec `useDialogFocus` et `useBackClose`, suppression annulable, cibles de 44 px, mouvement réduit respecté pour le flash. Le geste clé (photo, recadrage, export) a quatre trous nets.
- Le plus grave : l'export peut livrer un fichier périmé après modification des pages (C1).
- Le reste : retours visuels manquants dans le viseur (capture ratée, caméra en cours d'ouverture, flux coupé), poignées de recadrage rognées aux bords, et un enchaînement Reprendre + import multiple qui abandonne la file.

## Critique

### C1. L'export reste « prêt » après un changement de pages (fichier périmé)
- `ExportPanel.tsx:26,32-38,135-143` ; monté en continu par `ScannerApp.tsx:237`.
- Scénario : j'exporte 4 pages en PDF, je vois qu'une page est floue, je fais « Reprendre » ou « Supprimer », puis je reviens à Exporter. `fichiers` n'est invalidé que par un changement de nom, de format ou de qualité, jamais par un changement de `pages`. Le bouton « Créer » reste masqué et « Partager » ou « Télécharger » envoient l'ancien PDF. Le message ne dit que le nom et le poids du fichier, donc rien ne signale l'écart.
- Axe : Purpose et Memorable detail (le dernier geste du module livre un résultat faux, sans signal).
- Correctif : mémoriser une signature des pages au moment de la génération (`pages.map(p => p.id).join("|")`) et traiter `fichiers` comme `null` si elle diffère. Éviter un `key` sur le panneau, qui réinitialiserait nom, format et qualité.
- Correctif sûr : oui.

## Important

### I1. Poignées de recadrage rognées au bord de l'image
- `EditeurCoins.tsx:128-161` (le `<svg>` n'a pas `overflow-visible`) ; `quadParDefaut(w,h,0)` à `:188`.
- Scénario : « Photo entière » place les 4 coins exactement sur les bords, et la détection auto colle souvent le cadre aux bords. Un `<svg>` en ligne rogne son contenu (`overflow: hidden` par défaut) : seul un quart du rond visible et de la zone de prise (2 × rayon) reste attrapable. Sur une photo paysage d'environ 360 px de large, la zone de prise fait déjà environ 40 px, donc un quart est trop petit pour un doigt.
- Axe : Memorable detail (le recadrage au doigt est le geste précis du module).
- Correctif : `overflow-visible` sur le `<svg>` (le wrapper a déjà `p-3` de marge).
- Correctif sûr : oui.

### I2. Capture ratée en silence, avec un éclair qui promet le contraire
- `Viseur.tsx:129-145` (flash `:134-137`, `catch` vide `:140-142`).
- Scénario : si la caméra s'est coupée entre-temps, `videoWidth` vaut 0 et `capturerImage` lève une exception. L'écran a clignoté (« la photo est partie » d'après le commentaire de `:181`), puis rien ne se passe et aucune page n'arrive. L'utilisateur croit avoir pris la photo.
- Axe : Memorable detail (retour visuel du geste le plus fréquent) et Tone (pas de message).
- Correctif : n'allumer le flash qu'après une capture réussie, ou ajouter un message d'erreur calme (« La photo n'a pas pu être prise. Réessaie. ») avec `role="alert"`, effacé à la prochaine tentative.
- Correctif sûr : oui (ajout seul).

### I3. Caméra : écran noir muet pendant l'ouverture, aucun nouvel essai après un refus
- `Viseur.tsx:63-96,187-215`.
- Scénario 1 : à l'ouverture (invite de permission ou démarrage lent), ni `pret` ni `erreur` : le viseur est un écran noir sans libellé, les pastilles ne s'affichent qu'une fois `pret` (`:187`).
- Scénario 2 : permission refusée. Le texte est clair (`:199-206`) mais le seul bouton est « Importer une photo ». Après avoir autorisé la caméra dans les réglages, il faut fermer et rouvrir le viseur, sans bouton « Réessayer ». Le bloc d'erreur n'a pas `role="alert"`.
- Axe : Memorable detail et Audience (utilisateur expert, mais la prise de photo ne doit jamais sembler cassée).
- Correctif : afficher « Ouverture de la caméra… » (`role="status"`) tant que `!pret && !erreur`. Ajouter « Réessayer » dans le bloc d'erreur (relancer l'effet via un compteur d'essai) et `role="alert"` sur ce bloc.
- Correctif sûr : oui.

### I4. Flux caméra coupé en arrière-plan : aucun rétablissement (à confirmer sur appareil)
- `Viseur.tsx:63-96` (aucun écouteur `ended` / `mute` sur la piste, aucun `visibilitychange`).
- Scénario : j'ouvre le viseur, je bascule vers une autre app (PWA mobile), je reviens. Sur iOS et certains Android la piste est arrêtée : image figée, détection figée, le bouton de capture reste actif et aboutit à I2.
- Axe : Memorable detail et Constraints (usage mobile, hors ligne et interruptions).
- Correctif : sur `piste.onended`, passer à l'erreur « indisponible » (avec « Réessayer » de I3). Ou relancer `getUserMedia` au retour de visibilité.
- Correctif sûr : oui pour l'écouteur `ended`.

### I5. « Reprendre » puis import multiple : la file de photos est abandonnée
- `ScannerApp.tsx:117-136` (`fermerViseur()` à `:128` avec `setFile(f => f.slice(1))` à `:130`) et `Viseur.tsx:54` ; `EditeurCoins.tsx:224`, `useBackClose`.
- Scénario : « Reprendre » sur la page 2, dans le viseur « Importer », je choisis 3 photos. Je valide la première : la page est remplacée et `fermerViseur()` démonte le viseur. Son nettoyage `useBackClose` appelle `history.back()` pendant que `EditeurCoins` est toujours monté avec 2 photos en attente. Le `popstate` voit un jeton différent et déclenche `onFermer` : `setFile([])`, les 2 photos restantes sont perdues sans message, et il reste une entrée d'historique fantôme.
- Axe : Memorable detail (action qui annule une autre : Sequential Undo). L'ordre des appels est plausible d'après la lecture, pas testé.
- Correctif : ne fermer le viseur qu'une fois la file vide, ou fermer le viseur sans déclencher le `popstate` de l'éditeur.
- Correctif sûr : non (touche l'enchaînement et l'historique, à tester au doigt).

### I6. Import de plusieurs photos : aucun retour, tout-ou-rien, mémoire
- `ScannerApp.tsx:103-115` ; `traitement.ts:chargerImage` (plafond 3000 px).
- Scénario : j'importe 10 photos. Rien n'indique la lecture en cours : les boutons « Scanner » et « Importer » restent actifs, on peut relancer un import. Les 10 `ImageData` (jusqu'à 36 Mo chacune) sont chargées avant d'ouvrir la première, donc environ 360 Mo en mémoire sur un téléphone. Une seule image illisible rejette tout le lot (« Impossible de lire cette image. ») et les images valides déjà lues sont perdues.
- Axe : Purpose (une main, quelques secondes) et Constraints (usage mobile).
- Correctif : ajouter un état `importEnCours` (boutons désactivés, « Lecture des photos… » en `role="status"`) : sûr. Charger paresseusement une photo à la fois et garder les photos valides : non sûr (changement de comportement).
- Correctif sûr : oui pour l'indicateur, non pour le chargement paresseux.

### I7. Format et qualité en boutons « primaires » : trois verts qui se concurrencent
- `ExportPanel.tsx:100-133` (choix), `:136`, `:151` (CTA).
- Scénario : deux paires de boutons pleine hauteur, dont l'actif est vert plein, puis le CTA « Créer le PDF » lui aussi vert plein. On ne voit plus quel bouton déclenche l'export. DESIGN.md réserve les choix à 2-4 options à `SegmentedControl` (« jamais une couleur de module pour l'actif »).
- Axe : Constraints et Memorable detail.
- Correctif : `<SegmentedControl options=… ariaLabel="Format" />` pour Format et Qualité, en gardant `modifier(set)`. Le CTA reste le seul bouton plein.
- Correctif sûr : oui (même état, même invalidation).

## Mineur

### M1. Pastille d'état du viseur annoncée à chaque bascule
- `Viseur.tsx:187-195` : `role="status"` sur un texte qui alterne « Feuille repérée » / « Cherche la feuille… » au rythme de la détection (toutes les 120 ms). Un lecteur d'écran peut répéter les annonces.
- Axe : Tone (calme). Correctif : retirer `role="status"` (information visuelle), ou n'annoncer que la première détection. Sûr : oui.

### M2. Messages d'erreur techniques ou non annoncés
- `ScannerApp.tsx:132`, `ExportPanel.tsx:55` : `e.message` brut affiché (message Dexie ou canvas possible : quota, « Canvas indisponible »). `EditeurCoins.tsx:173-175` : « Les coins se croisent… » sans `role` ni `aria-live`, alors que le cadre passe au rouge.
- Axe : Tone. Correctif : message générique en français ; `role="alert"` sur le message des coins. Sûr : oui (texte et attribut).

### M3. Le coin saute sous le doigt au premier mouvement
- `EditeurCoins.tsx:94-103,151-155` : le coin prend la position du doigt (`p = clientX/Y`) au lieu de conserver le décalage de la prise, jusqu'à 2 × rayon (environ 20 px) de saut au démarrage du geste.
- Axe : Memorable detail (précision du recadrage). Correctif : mémoriser le décalage au `pointerdown`. Sûr : non (affine un geste ; à tester à la main).

### M4. `transition` générique à la place d'une transition explicite
- `ScannerApp.tsx:215`, `Viseur.tsx:243`, `ApercuPage.tsx:199,270` : `transition` + `active:scale`. DESIGN.md (« Tokens de finition ») demande `transition-transform` (ou `transition-colors` pour la bascule Original/Résultat).
- Axe : Constraints. Sûr : oui.

### M5. Écrans immersifs : couleurs en dur, hors DESIGN.md
- `Viseur.tsx:173-174,192,210`, `EditeurCoins.tsx:41,54-55,138-139,158,169,174`, `ApercuPage.tsx:199,258` : `rgb(80,220,140)`, `text-red-300`, `bg-white/15`, `shadow-[0_2px_12px_rgba(0,0,0,0.6)]`. Le Journal a son exception documentée (barre d'outils immersive), pas le Scanner. Une ombre ad hoc s'ajoute aux deux tokens de la « Two Shadows Rule ».
- Axe : Constraints. Correctif : documenter le Scanner dans « Exceptions assumées » de DESIGN.md (fond noir, vert de cadre, rouge d'erreur). Sûr : oui (documentation seule).

### M6. Texte d'accueil permanent et état vide redondant
- `ScannerApp.tsx:186-187,201-203` : paragraphe d'explication toujours visible plus carte « Aucune page… Appuie sur « Scanner » », qui disent la même chose. Audience : expert quotidien, sans onboarding.
- Axe : Audience. Correctif : garder uniquement la mention de confidentialité (« Les pages restent sur cet appareil »), fusionner avec l'état vide. Sûr : oui.

### M7. Panneau d'export : détails
- `ExportPanel.tsx:144` : `role="status"` sur un conteneur qui contient trois boutons (la région vivante annonce tout) ; à limiter au `<p>`.
- `:158` : « Vider le brouillon » en `secondaryButton`, collé à « Télécharger » (même apparence neutre) ; `dangerButton` serait cohérent avec la suppression d'une page (`ScannerApp.tsx:226`). Le `ConfirmDialog` limite le risque.
- `:147` : `toFixed(2)` donne « 2.45 Mo » (point), alors que l'app est en français : `toLocaleString("fr-FR", …)` et `tabular-nums`.
- Axes : Constraints et Tone. Sûr : oui.

### M8. « Annuler » ambigu et retour système qui vide toute la file
- `EditeurCoins.tsx:178-185` : « Annuler » abandonne la photo en cours sans confirmation. Dans le flux viseur, cela revient à « reprendre » ; en import, la photo est abandonnée. `ScannerApp.tsx:262-266` : Retour ou Échap vide toute la file. Un geste de retour Android accidentel perd N photos importées (récupérables depuis la galerie).
- Axe : Tone et Purpose. Correctif : libellé « Reprendre la photo » dans le flux viseur, « Ignorer cette photo » en import ; garder le retour tel quel ou confirmer s'il reste plus d'une photo. Sûr : non (comportement).

### M9. Échap ferme le viseur ET l'éditeur empilés
- `src/hooks/useDialogFocus.ts:39-41` : `stopPropagation()` n'empêche pas l'autre écouteur du même `document`. Avec le viseur en pause sous `EditeurCoins`, Échap déclenche `onClose` des deux (clavier externe seulement).
- Axe : Constraints (focus et Échap de `Modal` / dialogues). Correctif : `stopImmediatePropagation()` plus pile de dialogues. Sûr : non (hook partagé par toute l'app).

### M10. Page vide entre deux pages de l'aperçu
- `ApercuPage.tsx:93-98` : `aller()` fait `setUrl(null)`, donc un instant noir entre deux pages. Conserver l'ancienne URL jusqu'à la nouvelle supprimerait le clignotement.
- Axe : Constraints (finitions). Sûr : oui.

## Options structurantes (non appliquées)

1. **Balayage horizontal dans l'aperçu.** `ApercuPage` n'a que les flèches ; à zoom 1 le glissement d'un doigt ne fait rien (`:137`). Ajouter un balayage à zoom 1 et des actions « Reprendre » et « Supprimer » depuis l'aperçu.
2. **Réorganiser les pages.** `ajouterPage` gère déjà `ordre`, mais aucune interface ne le modifie : une page mal placée oblige à supprimer et rescanner. Poignée ou boutons « monter / descendre ».
3. **Export toujours accessible.** `ExportPanel` est sous la liste ; avec 10 pages ou plus, il faut défiler longtemps. Barre d'action « Exporter (N) » collée en bas, ou export replié en haut.
4. **Viseur plus rapide au quotidien.** Capture automatique quand « Feuille repérée » est stable pendant environ 1 s, lampe torche, appui pour la mise au point, mode rafale pour les documents de plusieurs pages (geste « Memorable detail » du module).
5. **Réglage fin des coins sans glisser.** Poignées focalisables avec flèches clavier ou boutons de décalage, pour une alternative au glissement (WCAG 2.5.7) et au S Pen.
6. **Exporter et partager en un tap.** Aujourd'hui deux étapes (créer, puis partager). Le partage natif exige une activation récente (quelques secondes) : à n'envisager que pour peu de pages, ou avec un message « Prêt, touche pour partager » conservé.

## Déjà couvert par l'audit du 2026-11-07 (cité, non refait)

- **Écrans plein écran (Viseur, EditeurCoins, ApercuPage) : `useDialogFocus` « non lu en détail »** (Accessibilité M7). Vérifié ici : les trois l'utilisent (`Viseur.tsx:55`, `EditeurCoins.tsx:225`, `ApercuPage.tsx:66`) avec `role="dialog"` et `aria-modal`. Les réserves restantes sont M9 ci-dessus.
- **`<img>` natifs avec `alt`** (`ApercuPage.tsx:234`, Accessibilité M7) : conforme.
- **`viewportFit: "cover"`** (À décider, point 8) : `layout.tsx` ne le définit pas, donc les `env(safe-area-inset-*)` des trois overlays (`Viseur.tsx:190,221,229`, `EditeurCoins.tsx:111,177`, `ApercuPage.tsx:212,244`) valent 0 aujourd'hui. À décider avec ce point, pas ici.
- **`Permissions-Policy: camera=(self)`** (Sécurité I3) : non posée ; elle devra rester ouverte à la caméra du scanner si elle est ajoutée.
- **Tests manquants pour `lib/scanner/traitement.ts` et `scenes.ts`** (À décider point 9, Qualité n° 6) : inchangé.
- **Dexie : `toArray()` sur `scannerPages`** (Performance M8) : `listerPages` charge toujours toutes les lignes avec leurs Blobs.
- **Fermeture d'une feuille par clic sur le fond (`Modal`)** (Accessibilité I3) : sans effet dans le Scanner, les overlays ne ferment pas sur le fond. Le `ConfirmDialog` de `ExportPanel` hérite du comportement du composant partagé.
- **`tabular-nums`, `text-wrap`, `transition-all` absent, zones de tap 44 px** (Fit-and-finish) : constats confirmés dans le Scanner (compteurs en `tabular-nums`, `ghostButton` / `dangerButton` avec `zoneTap44`), sauf M4 ci-dessus.

## Décompte

Critique : 1 · Important : 7 · Mineur : 10 · Options structurantes : 6.
