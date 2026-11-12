# Audit design du module Notes — 2026-11-12

Lecture seule, trois passes de la grille du brief (conformité/a11y, parcours, finitions). Périmètre : `src/app/(app)/notes/**`, `Modal`, `CheckToggle`, `lib/ui.ts`, `lib/notes/*`, `lib/offline/queue.ts`. Rien exécuté (ni build, ni lint, ni tests) ni mesuré au rendu : les tailles et contrastes sont estimés d'après le code et les tokens, les points « à confirmer » sont signalés. `ConfirmDialog` n'est pas utilisé par le module (suppression avec annulation différée).

## Résumé

- Base saine : annulation de suppression, mises à jour optimistes avec file hors ligne pour la coche, `Modal` accessible, tokens de couleur respectés. Aucun constat critique.
- Les écarts viennent surtout du geste le plus fréquent du module (cocher / ajouter un item) : saisie perdue à l'enregistrement, cible de coche de 22 px, épingle sans file hors ligne, éditeur de checklist qui valide au blur et à Entrée.
- Seconde famille : états de boutons à bascule non annoncés et petites incohérences avec DESIGN.md (couleur du texte des étiquettes, `textButton`, `transition` générique).

## Critique

Aucun.

## Important

### I1. Item saisi mais non ajouté : perdu à « Créer la note » / « Enregistrer »
- **Fichiers** : `NoteForm.tsx:153-169` (éditeur, note existante), `:209-225` (brouillon, création), `:423` (submit). `nouvelItem` est un état local de sous-composant, absent du `FormData`.
- **Scénario** : nouvelle checklist « Courses », l'utilisateur tape le dernier item « Pain » puis appuie directement sur « Créer la note » sans toucher « Ajouter » ni Entrée. La note est créée sans « Pain », sans avertissement. Même chose en édition avec le champ « Ajouter un item… ».
- **Axe** : Memorable detail (ajout rapide irréprochable) et Purpose.
- **Correctif** : à la soumission, inclure le texte en attente (hidden `item_libelle` ajouté à `draftItems` au submit ; en édition, appeler `addNoteItem` avant `updateNote`), ou à défaut désactiver le submit tant que le champ n'est pas vide.
- **Correctif sûr : non** (change les données soumises, faible risque).

### I2. Coche d'item en tuile : cible réelle de 22 px
- **Fichier** : `NoteCard.tsx:265-273` (`size={18}`, `hitSlop={2}` donc 18 + 2×2 = 22 px). Le texte de l'item (`:274`) n'est pas cliquable. La feuille de lecture est correcte (`:330-336`, 22 + 2×6 = 34 px, 22 px visibles).
- **Scénario** : cocher « lait » depuis la grille, d'une main, sur une colonne de ~160 px : cible plus petite que le plancher de 24 px recommandé WCAG 2.5.8 hors exception d'espacement, et très loin des 44 px du brief, pour le geste le plus fréquent du module. Le `hitSlop` réduit est volontaire (rangées de 6 px, voir le commentaire `:270`), mais il sacrifie le geste principal.
- **Axe** : Memorable detail (zone tactile) et Audience (une main).
- **Correctif** : rendre toute la ligne (coche + libellé) cliquable pour la bascule : cible large de ~20 px de haut sur toute la largeur, ou augmenter l'interligne (`gap-1.5` vers `gap-2.5`) et `hitSlop` en conséquence.
- **Correctif sûr : non** (le tap sur le libellé change de comportement ; le changement d'interligne modifie la densité).

### I3. Épingle : aucune file hors ligne, bouton verrouillé tant que la mutation est « en pause »
- **Fichiers** : `NoteCard.tsx:74-100` (pas de `networkMode: "always"`, pas de `enqueueAction`), `:234` (`disabled={pinMutation.isPending}`) ; `lib/offline/queue.ts:28` (le registre `notes` ne contient que `toggleNoteItem` et `deleteNote`).
- **Scénario** : hors ligne, tap sur l'épingle. L'étoile se remplit (optimiste), TanStack met la mutation en pause, `isPending` reste vrai : le bouton reste grisé jusqu'au retour réseau, sans toast. Si l'app est fermée avant, l'épinglage est perdu silencieusement. La coche d'item et la suppression, elles, passent par la file.
- **Axe** : Memorable detail (comportement hors ligne) et Audience (usage parfois hors ligne).
- **Correctif** : ajouter `toggleEpingle` au registre et reprendre le patron de `itemMutation` (`networkMode: "always"`, `enqueueAction`, toast « sera synchronisé »).
- **Correctif sûr : non** (touche la file et son registre).

### I4. Renommage d'item : Entrée ferme tout le formulaire, et le premier tap suivant est avalé
- **Fichier** : `NoteForm.tsx:105-117` (champ sans `onKeyDown`, valide au `blur`), `:120,131,142` (`disabled={isPending}` sur ↑ ↓ ×), `:305` (`<form>`).
- **Scénarios** :
  1. Dans la feuille « Modifier la note » d'une checklist, on corrige un libellé et on valide avec la touche Entrée / OK du clavier mobile. Le champ est dans un `<form>` : la soumission implicite enregistre la note et ferme la feuille (`onDone`). L'utilisateur voulait seulement valider le champ.
  2. On modifie un libellé puis on touche directement ↓ : le `blur` lance le renommage, `isPending` passe à vrai et grise ↑ ↓ × avant que le `click` n'arrive. Le premier tap est perdu, il faut le refaire.
- **Axe** : Memorable detail (geste d'édition fiable) et Audience (mémoire musculaire, une main).
- **Correctif** : `onKeyDown` Entrée → `preventDefault()` + `blur()` sur ce champ (comme `ajouter`, `:157-162`) ; ne pas lier `disabled` des boutons à un `isPending` global (le limiter à la ligne concernée).
- **Correctif sûr : oui** pour Entrée ; **non** pour la portée du `disabled`.

### I5. Suppression d'item « × » immédiate, collée à « ↓ », et boutons Enregistrer / Annuler trompeurs
- **Fichiers** : `NoteForm.tsx:129-150` (↓ et × séparés de 6 px, `gap-1.5`), `NoteCard.tsx:402-415` (« Annuler » sous le formulaire).
- **Scénario** : en réordonnant avec ↑ ↓, un tap décalé touche « × » : l'item est supprimé en base immédiatement (`deleteNoteItem`), sans annulation, alors que la note entière a un toast « Annuler ». Plus largement, en édition d'une checklist, toutes les modifications d'items sont déjà écrites : « Annuler » ne les annule pas, et « Enregistrer » n'enregistre que titre, couleur et tags.
- **Axe** : Memorable detail (annulation) et Tone (aucune action irréversible silencieuse).
- **Correctif** : réutiliser `supprimerAvecAnnulation` pour « × » (masquage local + toast Annuler), écarter ou séparer le groupe ↑ ↓ de « × » ; renommer « Annuler » en « Fermer » en édition de checklist.
- **Correctif sûr : non** (comportement).

### I6. Boutons à bascule sans `aria-pressed` : épingle, pastilles de couleur, tags, filtres
- **Fichiers** : `NoteCard.tsx:232-241` (épingle, état porté par la seule couleur et le remplissage), `NoteForm.tsx:361-380` (pastilles de couleur : la sélection tient à une bordure verte), `:389-398` (tags), `NotesGrid.tsx:111-120` (filtres). `AssistantNoteModal.tsx:208,224` pose pourtant `aria-pressed` sur le même type de pastille.
- **Scénario** : au lecteur d'écran, « Épingler » reste « Épingler » une fois la note épinglée (le libellé change, mais pas l'état d'un groupe de pastilles) ; les filtres et couleurs n'annoncent jamais leur sélection. Incohérence interne au module.
- **Axe** : Constraints (WCAG 4.1.2, grille passe 1). Même famille que le constat I2 de l'audit global (habitudes).
- **Correctif** : `aria-pressed={actif}` sur ces quatre groupes ; `aria-pressed={note.epingle}` avec un libellé fixe « Épingler ».
- **Correctif sûr : oui**.

### I7. Titres de tuile tronqués à ~100 px en grille 2 colonnes
- **Fichier** : `NoteCard.tsx:228` (`nameText` = `truncate`, `min-w-0 flex-1`), `NotesGrid.tsx:132,144` (`columns-2`). Estimation sur téléphone 360-390 px : colonne ≈ 160 px, intérieur de la carte ≈ 126 px, moins l'épingle ≈ 100 px, soit une douzaine de caractères.
- **Scénario** : « Idées cadeau maman » devient « Idées cadeau… », « Idées cadeau Léa » aussi : on ne reconnaît plus la note en un coup d'œil, alors que l'écran sert à consulter vite. `DESIGN.md` prévoit `nameTextComplet` précisément pour ce cas (`lib/ui.ts:93-97`).
- **Axe** : Purpose (consulter en quelques secondes).
- **Correctif** : `nameTextComplet` (ou `line-clamp-2`) sur le titre. Même point, à confirmer au rendu : la rangée « Modifier » + « Suppr. » (`:297-309`, `gap-2`, ≈ 150 px estimés) risque de dépasser les 126 px intérieurs sur 360 px de large.
- **Correctif sûr : oui** (visuel seul).

### I8. Texte des étiquettes colorées sans mélange avec `--ink`
- **Fichiers** : `NoteCard.tsx:36-39` (`color: couleur` brut), utilisé aux `:290` et `:356`. `taches/TasksList.tsx:105` applique la règle : `color-mix(in oklch, couleur 55%, var(--ink))`.
- **Scénario** : une étiquette jaune ou cyan choisie par l'utilisateur donne un texte `text-micro` (11 px) clair sur fond teinté à 10 % : illisible, en contradiction avec la règle de contraste de `DESIGN.md` (« le texte d'une étiquette colorée par l'utilisateur est mélangé à 45 % d'`--ink` »).
- **Axe** : Constraints (tokens et contraste de DESIGN.md).
- **Correctif** : reprendre `color-mix(in oklch, ${couleur} 55%, var(--ink))`, idéalement via une fonction partagée avec `TasksList`.
- **Correctif sûr : oui**.

## Mineur

### M1. « Annuler » artisanal sous les formulaires : cible de ~20 px et pas d'anneau de focus
- **Fichiers** : `NoteCard.tsx:412`, `AddNoteToggle.tsx:48` (`mt-2 text-sm text-ink-2 underline`). `lib/ui.ts:67-68` fournit `textButton` (min 44 px + `focusRing`) précisément pour ce cas.
- **Scénario** : appui imprécis sous le gros bouton « Créer la note » ; en saisie inline, « Annuler » jette la note en cours sans confirmation.
- **Axe** : Constraints (composant existant, focus-visible). **Correctif** : `className={textButton}`. **Correctif sûr : oui**.

### M2. Ouverture du formulaire d'ajout sans focus sur le titre
- **Fichiers** : `AddNoteToggle.tsx:21,39-47`, `NoteForm.tsx:330` (aucun `autoFocus`, `AnimatedAddCard` ne place pas le focus non plus). Concerne aussi `?action=new` (`page.tsx:36`).
- **Scénario** : depuis le raccourci « Nouvelle note », le formulaire s'ouvre mais le clavier ne monte pas : un tap de plus pour la capture rapide.
- **Axe** : Memorable detail. **Correctif** : focus sur le titre à l'ouverture. **Correctif sûr : non** (clavier et défilement à tester sur iOS/Android).

### M3. Noms accessibles non uniques et champs sans libellé
- **Fichiers** : `NoteCard.tsx:298-308` (« Modifier » / « Suppr. » répétés pour chaque note), `:268,333` et `NoteForm.tsx:99` (« Cocher l'item » sans le nom de l'item), `NoteForm.tsx:154,210` (champs « Ajouter un item… » sans `aria-label`, non listés dans l'audit global), `NotesGrid.tsx:100` (recherche, confirmé sans libellé).
- **Axe** : Constraints (WCAG 2.4.6, 4.1.2). **Correctif** : `aria-label` contextuels (`Modifier la note « … »`, `Supprimer la note « … »`, `Cocher « libellé »`) ; remplacer « Suppr. » par « Supprimer ». **Correctif sûr : oui**.

### M4. « +N autres » sans zone de tap
- **Fichier** : `NoteCard.tsx:280` (`text-xs`, ~16 px de haut, aucun `after:`). **Scénario** : ouvrir la note complète depuis la tuile. **Axe** : Constraints (cible). **Correctif** : réutiliser `linkButton` ou `zoneTapPill`. **Correctif sûr : oui**.

### M5. Barre de progression des checklists
- **Fichiers** : `NoteCard.tsx:259-261,324-326`. (a) Aucun `role="progressbar"` ni texte alternatif (« 3 sur 8 »). (b) La piste `bg-surface-alt` (L ≈ 0,935) sur une teinte de note (L ≈ 0,93) est quasi invisible en thème clair. (c) La largeur est animée par `style` sans `transition-[width]` alors que `DESIGN.md` documente ce motif : la barre saute à chaque coche.
- **Axe** : Constraints (non-text contrast, a11y) et Tone (mouvement discret). **Correctif** : `role="progressbar"` + `aria-valuenow`, texte `tabular-nums` « 3/8 », `bg-ink/10` pour la piste, `transition-[width]`. **Correctif sûr : oui**.

### M6. Pastilles de couleur non sélectionnées quasi invisibles
- **Fichier** : `NoteForm.tsx:375-379` (`border-transparent` sur un fond L ≈ 0,92 posé sur `surface` L ≈ 0,995, soit un contraste proche de 1,1:1 ; seule « Aucune couleur » a `border-line`). **Axe** : Constraints (WCAG 1.4.11, `--control-border` documenté pour ce cas). **Correctif** : `border-line` ou `border-control-border` à l'état inactif. **Correctif sûr : oui**.

### M7. Pastilles de filtre : mise en page qui bouge et cible courte
- **Fichier** : `NotesGrid.tsx:111-120` (`font-bold` à l'état actif contre `font-semibold` au repos : la pastille s'élargit et pousse les voisines ; hauteur ≈ 24 px sans `zoneTapPill`, que `gap-2` ne permet pas d'ajouter, il exige ≥ 16 px entre rangées).
- **Axe** : Constraints (finitions, zones de clic). **Correctif** : garder `font-semibold` dans les deux états, `gap-y-4` puis `zoneTapPill`. **Correctif sûr : oui**.

### M8. `transition` générique avec les animations framer-motion
- **Fichiers** : `NoteCard.tsx:220` (`transition` sur un `motion.li` qui anime déjà `opacity`, `y` et `layout`), `AssistantNoteModal.tsx:320` (`transition active:scale-[0.99]`). `DESIGN.md` demande des transitions explicites (`transition-transform`). Le `transition` générique inclut `opacity` et `transform` : les transitions CSS et framer se superposent, risque d'effet « élastique » à l'entrée et à la sortie (à confirmer au rendu). Même rubrique, finition : `NoteForm.tsx:424` « Enregistrement... » (trois points) alors que le module utilise « … » ailleurs.
- **Axe** : Constraints (tokens de mouvement). **Correctif** : `transition-transform`. **Correctif sûr : oui** pour le libellé, **non** pour `transition-transform` sur le `li` tant que non vérifié au rendu.

### M9. « nouveau » en `opacity-80` sur fond vert
- **Fichier** : `AssistantNoteModal.tsx:230` (`text-micro ... opacity-80` sur `bg-kcal`). Contraste estimé ≈ 4,1:1 à 11 px, sous les 4,5:1 visés par `DESIGN.md` (calcul d'après les tokens clairs, à confirmer). **Axe** : Constraints. **Correctif** : retirer `opacity-80`. **Correctif sûr : oui**.

### M10. « → Tâche » / « Créer une tâche » répétables sans état
- **Fichier** : `NoteCard.tsx:175-184,343,365`. Le verrou `creationEnCours` ne protège que pendant l'appel ; une fois créée, rien n'indique que l'item a déjà donné une tâche, un second tap crée un doublon. Le toast « Tâche créée » n'a pas d'« Annuler » (alors que la suppression de la note en a un). Les zones de tap des liens « → Tâche » (`linkButton`, `after:-inset-y-3`) se chevauchent d'environ 8 px entre lignes proches (`gap-3`).
- **Axe** : Memorable detail (retour visuel, annulation). **Correctif** : action « Annuler » dans le toast et/ou état « Tâche créée » sur la ligne. **Correctif sûr : non**.

## Options structurantes (non appliquées, décision de Vincent)

1. **Tuile entière cliquable, sans boutons « Modifier » / « Suppr. »** : aujourd'hui chaque tuile ouvre la feuille par le titre seul, plus un aperçu masqué `aria-hidden`, et porte deux boutons pleine largeur. Ouvrir la feuille au tap de la tuile et déplacer Modifier/Supprimer dans la feuille (déjà présents, `NoteCard.tsx:379-386`) donnerait des tuiles plus denses et de grandes cibles (lié à I2, I7, M3).
2. **Éditeur de checklist unifié** : fusionner lecture et édition (cocher, renommer, ajouter directement dans la feuille de lecture, façon Keep) pour supprimer le mode « edit » séparé et le conflit écritures immédiates / « Enregistrer » (I1, I4, I5).
3. **Barre de filtres de tags défilante horizontalement** : avec beaucoup de tags, `flex-wrap` (`NotesGrid.tsx:109`) pousse les notes sous la ligne de flottaison.
4. **Persistance du filtre et de la recherche** entre deux ouvertures (aujourd'hui remis à zéro à chaque montage).

## Déjà couvert par l'audit du 2026-11-07 (cité, non refait)

- **I1** (champs sans nom accessible) : `NoteForm.tsx:105` et `NotesGrid.tsx:100`. Confirmés ici, voir M3 pour les occurrences non listées (`NoteForm.tsx:154,210`).
- **I3** (fermeture de la feuille au tap sur le fond, perte de saisie) : `Modal.tsx:40`, `NoteForm` explicitement cité.
- **I-2** (invalidation sans garde « en file », état optimiste qui revient) : `NoteCard.tsx:99,145,171`.
- **I-13** (`useBackClose` et `Activity`) : concerne `AddNoteToggle`.
- **I-14** (assistant IA empilé sur la lecture non fermé par le retour) et **M-13** (`AssistantNoteModal` sans entrée d'historique).
- **M-3** (`NoteForm` : rollback global de `toggleMutation`, pas de file hors ligne), `NoteForm.tsx:46-68`.
- **M-8** (création sans identifiant client, doublon après réponse perdue), `NoteForm.tsx:257-266`.
- Perf **I4** (framer-motion sans LazyMotion) : touche `NoteCard`, `Modal`, `CheckToggle`.
- Points **non retenus** : `Modal` (portal, focus piégé, bouton Fermer 44 px), `CheckToggle` (`aria-pressed`), `role="alert"` sur les erreurs, `prefers-reduced-motion` (`useReducedMotion` dans `NoteCard`) : conformes.
