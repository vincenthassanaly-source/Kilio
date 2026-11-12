# Audit design du module Courses (lecture seule) - 2026-11-12

Périmètre : `src/app/(app)/courses/**`, `CheckToggle`, `AnimatedAddCard`, `ToastHost`/`toast-store`, `lib/ui.ts`, `lib/courses/compute.ts`. Lecture statique, rien mesuré au rendu. Trois passes de la grille (conformité, parcours, finitions) ; sources : brief 2026-11-12, DESIGN.md, audit global 2026-11-07.

## Résumé

- Le geste central (coche) est bien construit : optimiste, rollback ciblé, repli Dexie, zone de tap 44 px. Les écarts touchent surtout le retour après la coche, le hors ligne en magasin et les noms accessibles.
- 0 critique, 6 importants, 12 mineurs ; 9 correctifs sûrs sur 18 sont des attributs, classes ou tokens existants.
- Cinq options structurantes sont listées à part (coche annulable, ajout épinglé, suppression par ligne, indicateur hors ligne, rayons repliables).

## Critique

Aucun.

## Important

### I1. Coche : nom accessible instable et anonyme
- `CourseItemRow.tsx:227-233` (+ `CheckToggle.tsx:47,49`). Le nom change (« Cocher l'article » / « Décocher l'article ») alors que `aria-pressed` porte déjà l'état : le lecteur d'écran annonce une double inversion (« Décocher l'article, activé »). Le nom ne contient pas le libellé : dans une liste de 20 articles, tous les boutons s'appellent pareil.
- Scénario : parcours au lecteur d'écran ou à la commande vocale (« toucher lait ») ; la coche est le geste le plus fréquent du module.
- Axe : Memorable detail (geste irréprochable). Passe 1.
- Correctif : `label={item.libelle}` (stable) et laisser `aria-pressed` annoncer l'état ; ou `describedBy` vers l'id du libellé.
- Correctif sûr : oui.

### I2. « Suppr. » : abréviation, nom identique sur chaque ligne
- `CourseItemRow.tsx:274-288`. Texte visible « Suppr. », aucun `aria-label` : N boutons homonymes, et l'abréviation est lue telle quelle.
- Scénario : navigation au lecteur d'écran ou commande vocale ; mauvaise cible possible sur une ligne voisine.
- Axe : Constraints (passe 1 de la grille, WCAG 2.4.6 / 4.1.2 / 2.5.3).
- Correctif : texte visible « Supprimer » et `aria-label={\`Supprimer « ${item.libelle} »\`}` (le nom contient le texte visible). Vérifier que la largeur reste correcte à 360 px.
- Correctif sûr : oui.

### I3. Articles « en attente de synchro » : contraste sous 4,5:1
- `CourseItemRow.tsx:226` (`opacity-60` sur tout le conteneur) et `:270-272` (le message « En attente de synchro » est dans ce conteneur). `ink-2` (8,3:1) à 60 % d'opacité tombe vers 3:1 ; le message d'état est justement celui qu'on lit hors ligne en magasin.
- Axe : Audience (usage hors ligne) et Constraints (contrastes, DESIGN.md).
- Correctif : appliquer `opacity-60` seulement à la coche et au libellé, sortir le `<span>` du bloc atténué (garder `text-ink-2` plein).
- Correctif sûr : oui.

### I4. Hors ligne : un toast par coche, empilés
- `CourseItemRow.tsx:64` (`showToast("Enregistré, sera synchronisé…")` à chaque `toggleCourseItem` mis en file) + `toast-store.ts` (aucune déduplication ; 3,2 s chacun). Sans réseau (sous-sol, caisse), 10 coches donnent jusqu'à 10 pilules empilées à 168 px du bas, au-dessus de la liste.
- Axe : Memorable detail (comportement hors ligne) et Tone (calme).
- Correctif : ne montrer qu'un seul toast d'information à la fois (remplacer le précédent de même texte) ou un indicateur discret persistant (voir option D).
- Correctif sûr : non (comportement du store partagé, à vérifier chez les autres appelants).

### I5. Coche sans retour ni annulation : l'article disparaît dans une section repliée
- `CourseItemRow.tsx:68-75`, `CoursesList.tsx:42-61`, `ArchivedCoursesSection.tsx:84-89`. Un article coché quitte aussitôt la liste active et part dans « Articles archivés (n) », repliée. Seul signe : le compteur baisse de 1 (12 px, `text-xs`). Pas de toast, pas d'« Annuler » (la suppression en a un, la coche non). Un tap raté d'une main sur une liste qui défile se détecte tard ; pour le défaire, il faut déplier l'archive et retrouver la ligne.
- Axe : Memorable detail (retour visuel, annulation).
- Correctif : voir option A. Rien de sûr à faire sans trancher (nouveau comportement).
- Correctif sûr : non.

### I6. « Fermer » du formulaire d'ajout : cible d'environ 20 px, token existant ignoré
- `AddCourseToggle.tsx:35`. `<button className="mt-2 text-sm text-ink-2 underline">` : environ 20 px de haut, sans `focusRing`. C'est la seule fermeture volontaire du formulaire (le formulaire reste ouvert après chaque ajout). `textButton` (`lib/ui.ts:68`, `min-h-11` + anneau de focus) existe pour ce cas (« Annuler sous un formulaire »).
- Axe : Purpose (d'une main) et Constraints (composants/tokens existants, cible 44 px).
- Correctif : `className={textButton}`.
- Correctif sûr : oui.

## Mineur

### M1. Bascule « Articles archivés » à environ 30 px
- `ArchivedCoursesSection.tsx:84-89` (`py-1` seulement) à côté de `Vider les cochés` (44 px, `ghostButton`, `:98-105`). Axe : Purpose. Correctif : `min-h-11` sur le bouton de bascule. Sûr : oui.

### M2. Message « ajouté » jamais effacé pendant la frappe suivante
- `AddCourseForm.tsx:222-226` (`handleChange` ne remet pas `messageStatut` à null) et `:332-336`. Le message « « lait » ajouté » reste à l'écran pendant qu'on tape « œufs » : on peut le lire comme concernant la saisie en cours. Axe : Memorable detail (retour clair de l'ajout rapide). Correctif : `setMessageStatut(null)` dans `handleChange`. Sûr : oui.

### M3. Animation de hauteur de l'archive non coupée en mouvement réduit
- `ArchivedCoursesSection.tsx:109-115`. `MotionConfig reducedMotion="user"` (providers.tsx) coupe transforms et layout, pas `height`. `AnimatedAddCard.tsx:21-25` gère déjà le cas via `useReducedMotion`. Axe : Tone (respect de `prefers-reduced-motion`). Correctif : durée 0 si `useReducedMotion()`. Sûr : oui.

### M4. Carte dans carte : rayon non concentrique, double ombre
- `ArchivedCoursesSection.tsx:78` (`card` : rayon 22, padding 16) contient des `listCard` (`CourseItemRow.tsx:217-225`, rayon 20, bordure + `shadow-card`). Rayon intérieur attendu 22 - 16 = 6 px, et l'ombre est doublée (règle de l'ombre unique). Axe : Constraints (rayons/ombres de DESIGN.md). Correctif : variante plate pour les lignes archivées (sans ombre, `bg-surface-alt`, rayon `xs`/`sm`). Sûr : oui (purement visuel).

### M5. Compteurs sans `tabular-nums`
- `CoursesList.tsx:42-44` (« N articles à prendre », change à chaque coche) et `ArchivedCoursesSection.tsx:88`. Le texte voisin tremble d'un chiffre à l'autre. Axe : Tone. Correctif : `tabular-nums`. Sûr : oui.

### M6. Squelettes plus petits que le contenu réel
- `loading.tsx:9` (`h-11`, rayon 16) contre la carte d'ajout réelle (environ 70 px, rayon 22) ; `ListItemSkeleton` (environ 50 px) contre une ligne réelle (au moins 72 px : `p-3.5` + 44 px). Saut de mise en page au chargement. Axe : Tone. Correctif : `h-[70px] rounded-card` et hauteur mini de ligne alignée. Sûr : oui.

### M7. Libellés tronqués par « … »
- `CourseItemRow.tsx:265` (`nameText` = `truncate`). « Yaourt grec bio 8x125g » et « Yaourt grec bio 4x125g » deviennent identiques ; `ui.ts:93-96` prévoit `nameTextComplet` pour ce cas. De plus, un `<p>` dans un `<button>` (`:258-268`) est invalide en HTML. Axe : Purpose (consulter en quelques secondes). Correctif : `nameTextComplet` + `<span>`. Sûr : oui.

### M8. « Annuler » de suppression affiché après la réponse serveur
- `CourseItemRow.tsx:112-126` : le toast est dans `onSuccess`, alors que la ligne disparaît dès `onMutate`. Sur réseau lent, la ligne est partie sans filet pendant plusieurs secondes. Axe : Memorable detail (annulation). Correctif : afficher le toast dès `onMutate` et le retirer en cas d'erreur. Sûr : non (séquence des toasts).

### M9. Dernière ligne d'un rayon : l'en-tête saute sans sortie animée
- `CoursesList.tsx:47-52`. L'`AnimatePresence` est dans la section : quand elle disparaît, l'en-tête et la ligne partent d'un coup et la liste remonte sous le doigt. Axe : Tone. Correctif : envelopper les sections dans un `AnimatePresence` (+ `layout`). Sûr : oui.

### M10. Rayons sans sémantique
- `CoursesList.tsx:48-49` : le nom du rayon est un `<p>`, la `<ul>` n'a pas de nom. Axe : Constraints (passe 1). Correctif : `<h2>` (même classes) et `aria-labelledby` sur la `<ul>`. Sûr : oui.

### M11. `layout` framer et `transition-transform` CSS sur le même `<li>`
- `CourseItemRow.tsx:217-225` avec `listCard` (`ui.ts:86-87`, `transition-transform duration-150 active:scale`). Framer pilote `transform` en ligne à chaque image ; la transition CSS lisse ces valeurs et peut donner un décalage au réagencement (à confirmer au rendu). Axe : Tone. Correctif : porter l'effet d'appui sur un enfant. Sûr : oui (à vérifier au rendu).

### M12. « Vider les cochés » : rollback par instantané complet
- `ArchivedCoursesSection.tsx:63-65` restaure tout `context.previous`, contrairement à `restaurerElement` ailleurs. Une coche faite pendant l'appel serait effacée à l'échec. Axe : Memorable detail (cohérence de l'état). Correctif : rollback ciblé sur les ids du snapshot. Sûr : non.

## Options structurantes (non appliquées)

- **A. Coche annulable** (I5). Garder l'article 3 à 4 s en place, barré, avec « Annuler » (ou un toast d'action groupé « 3 cochés · Annuler »), puis le glisser dans l'archive. Alternative : archive dépliée par défaut tant qu'il reste des actifs.
- **B. Ajout épinglé.** Le champ d'ajout est en haut d'une liste qui peut dépasser un écran ; en magasin il faut remonter. Une barre d'ajout épinglée au-dessus de la `BottomNav` serait cohérente avec le geste « ajout rapide », mais touche la navigation/les éléments épinglés.
- **C. Suppression par ligne.** Un « Suppr. » bordé de rouge sur chaque ligne alourdit une liste « calme » et expose une action destructive à chaque défilement (l'annulation existe). Alternatives : glissement ou menu par ligne, ou suppression seulement via le renommage.
- **D. Indicateur hors ligne persistant** (I4). Pastille « n en attente de synchro » dans l'en-tête, à la place des toasts répétés.
- **E. Rayons repliables** et mémorisation locale de l'état, pour les longues listes.

## Déjà couvert par l'audit du 2026-11-07 (cité, non refait)

- A11y I5 : renommage validé au `blur`, pas de bouton valider/annuler (`CourseItemRow.tsx:236-246`). Toujours en l'état ; non repris ici.
- A11y I1 (cas « à vérifier ») : champ `AddCourseForm.tsx:269-288` sans `aria-label` (placeholder seul, `role="combobox"`). Confirmé non corrigé ; relève du lot I1.
- Click-path I-2 : invalidation sans garde « en file » (`CourseItemRow.tsx:131,181`, `ArchivedCoursesSection.tsx:67`, `AddCourseForm.tsx:150-154`) et CLICK-PATH-401/402 (coordination des invalidations). Non repris. M12 ci-dessus ne concerne que le rollback.
- M-4 : ajout depuis le FAB avec cache absent (`AddCourseForm.tsx:100-125`).
- M-5 : « Annuler » après une suppression mise en file (`CourseItemRow.tsx:112-126`, `undo.ts`). Le même effet vaut pour `Vider les cochés` (`ArchivedCoursesSection.tsx:56-62`).
- M6 (ToastHost) : `ariaLabel` explicite déjà fourni par les toasts de suppression de Courses ; rien à ajouter.
- Fit-and-finish global : `text-wrap` et `transition-all` déjà vérifiés ; seuls les points M4, M5, M7, M11 sont propres à Courses.
