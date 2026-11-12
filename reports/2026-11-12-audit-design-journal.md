# Audit design du module Journal, 2026-11-12

Lecture seule de `src/app/(app)/journal/**` et de la logique d'état de `src/lib/vidage` (`local.ts`, `VidageSync.tsx`, `traits.ts`). Aucune donnée réelle lue, verrou et variables d'environnement non touchés, rien d'exécuté (statique : contrastes jugés d'après les tokens de `DESIGN.md`, non mesurés). Brief : `reports/2026-11-12-brief-design.md`. Trois passes : conformité/accessibilité, parcours, finitions.

## Résumé

- Base saine : écriture locale d'abord, cibles de 44 px, `aria-*`, mouvement réduit respecté, aucun nouveau critique par rapport à l'audit du 2026-11-07 (le critique C-1 y figure déjà).
- Trois points importants touchent le geste central (écrire, changer d'outil, savoir que c'est gardé) : outil actif quasi invisible, statut d'enregistrement hors écran et au ton inquiet, brouillon clavier détruit par une bascule de mode ou un reverrouillage.
- Le reste est de la finition (ombres, rayons, titres du squelette, repère du jour dans le calendrier) ; presque tout est corrigeable sans changement de comportement.

Total : 0 critique, 3 importants, 11 mineurs.

---

## Critique

Aucun nouveau constat. Le critique du module (feuille ouverte vide après timeout écrasant la feuille serveur) est déjà décrit : voir la dernière section.

---

## Important

### I1. Outil et épaisseur actifs presque indiscernables
- Fichier : `src/app/(app)/journal/BarreOutils.tsx:71, 83, 100`
- Scénario : sur la barre flottante (fond `bg-surface/95`), l'état actif d'un outil ou d'une épaisseur n'est marqué que par `bg-surface-alt`. L'écart `surface` (0,995) / `surface-alt` (0,935) est d'environ 1,1:1, très loin des 3:1 attendus pour un état de contrôle (WCAG 1.4.11). Avec le S Pen, à une main et en pleine écriture, on ne voit pas si l'on est en stylo ou en gomme, ni quelle épaisseur est choisie ; seul `aria-pressed` le dit, et uniquement aux lecteurs d'écran.
- Axe violé : Memorable detail (retour visuel du geste le plus fréquent) ; Constraints (l'actif est en `kcal` partout ailleurs : `SegmentedControl`, `BottomNav`).
- Correctif proposé : état actif en `bg-kcal-soft text-kcal` (la pastille de la barre du bas) ou `ring-2 ring-kcal`, conserver `aria-pressed`. Le point d'épaisseur reste en `bg-ink`, ou passe en `bg-kcal` si actif.
- Correctif sûr : oui (visuel seul).

### I2. Le statut d'enregistrement est hors écran pendant l'écriture, et son libellé a un ton de retard
- Fichiers : `FeuilleView.tsx:326-332` (libellés), `:391-393` (rendu sous le canvas) ; `src/lib/vidage/VidageSync.tsx:10` (pause de 2 s avant envoi) ; `src/lib/vidage/traits.ts:9-10, 144` (feuille de 2000 unités minimum, soit environ 650 px sur un téléphone, qui grandit avec l'écriture).
- Scénario : la ligne « Enregistré » / « Gardé sur ton téléphone, envoi en attente » est placée après le canvas. Sur un téléphone elle se trouve à plus de 900 px du haut dès la feuille vide, donc invisible tant qu'on écrit en haut. Quand on la voit, elle bascule en « envoi en attente » après chaque pause d'écriture (relevé à chaque trait et toutes les 2,5 s, envoi 2 s après la dernière écriture), même en ligne et sans aucun souci. Chaque bascule est aussi annoncée (`aria-live="polite"`).
- Axe violé : Memorable detail (retour visuel et comportement hors ligne) ; Tone (jamais de vocabulaire de retard : « envoi en attente » pour un fonctionnement normal).
- Correctif proposé : remonter la ligne dans l'en-tête, sous la date, pour qu'elle reste visible. Afficher « Enregistré » tant que l'appareil est en ligne et que l'attente est courte ; réserver « Gardé sur ton téléphone, envoi dès que le réseau revient » à `!navigator.onLine` ou à une attente prolongée (par exemple plus de 10 s). Retirer l'annonce vocale des changements transitoires.
- Correctif sûr : oui (affichage seul, aucune logique de synchro modifiée).

### I3. Un brouillon clavier (ou une proposition éditée) est détruit par la bascule de mode ou par le reverrouillage
- Fichiers : `FeuilleView.tsx:368-369` (le mode clavier démonte `SaisieClavier` quand on repasse en « Stylo ») ; `SaisieClavier.tsx:16` (le texte vit dans l'état du composant) ; `VerrouGate.tsx:67-73, 86-109, 141` (la vue n'est rendue que si la phase est « ouvert » ; un contrôle de session toutes les 60 s et au retour au premier plan) ; `TranscriptionDialog.tsx:28` (texte de la proposition dans l'état du composant).
- Scénario A : en mode Clavier, on tape trois lignes puis on touche « Stylo » (le contrôle est juste au-dessus du champ) : le texte disparaît sans avertissement. L'aide sous le champ prévient que rien n'est gardé avant « Ajouter », mais la bascule de mode n'est pas un geste de validation.
- Scénario B : session de 15 minutes expirée (téléphone en poche avec une note à moitié tapée). Au retour, `visibilitychange` appelle `verifier()`, la phase passe à « fermé », l'écran de verrouillage remplace `FeuilleView` et le brouillon (comme une proposition de transcription corrigée à la main) est perdu. Les traits, eux, sont sauvés par Dexie : seule la saisie textuelle est exposée.
- Axe violé : Memorable detail (annulation et robustesse du geste) ; Purpose (saisie d'une main sans perdre le flux).
- Correctif proposé : remonter `valeur` dans `FeuilleView` (ou un état conservé hors du composant démonté) pour survivre à la bascule de mode ; pour le reverrouillage, voir l'option structurante O3 (garder la vue montée sous le verrou). Ne pas écrire de texte intime dans `localStorage`.
- Correctif sûr : non (change la durée de vie d'une saisie ; le point B touche le comportement du verrou, à décider).

---

## Mineur

### M1. « Transcrire » : icône seule et ambiguë sur téléphone
- Fichier : `BarreOutils.tsx:130, 135-137, 139` (libellé masqué sous 30 rem, soit 480 px, donc toujours masqué en portrait ; icône de trois lignes).
- Scénario : sur le téléphone, l'action la plus lourde du module (appel Gemini, vide la feuille à la validation) est un bouton noir avec trois traits, qui évoque un menu plutôt qu'une lecture de l'écriture.
- Axe violé : Memorable detail ; Audience (l'expert la connaît, mais l'icône ne la distingue pas du reste).
- Correctif proposé : icône spécifique (page avec curseur de texte ou « Aa ») ; conserver le nom accessible actuel.
- Correctif sûr : oui.

### M2. Ombre du menu et de la barre flottante : `shadow-card` au lieu de `shadow-float`
- Fichiers : `MenuFeuille.tsx:116`, `BarreOutils.tsx:64`.
- Scénario : le menu « … » et la barre d'outils recouvrent le contenu ; `DESIGN.md` réserve `--shadow-float` à ce qui flotte au-dessus (barre du bas, séance flottante, menus).
- Axe violé : Constraints (Two Shadows Rule).
- Correctif proposé : `shadow-float` sur les deux.
- Correctif sûr : oui.

### M3. Menu « … » ouvrable sans aucune action possible
- Fichiers : `MenuFeuille.tsx:118-135`, `FeuilleView.tsx:348-350`.
- Scénario : sur une feuille vide sans texte du jour, le menu s'ouvre sur une seule entrée désactivée (« Effacer la feuille »). Le focus ne va nulle part (`elementsActifs()[0]` est indéfini) et l'utilisateur n'a aucune explication.
- Axe violé : Memorable detail (aucun cul-de-sac sur un geste de la barre d'en-tête) ; Audience (mémoire musculaire).
- Correctif proposé : désactiver le déclencheur (`disabled`, opacité réduite) quand `!aTexte && !peutEffacer`, ou ajouter une ligne d'état vide dans le menu.
- Correctif sûr : oui.

### M4. En-tête : « Relire » (≈ 32 px) et « … » (44 px) côte à côte
- Fichiers : `FeuilleView.tsx:344-353` (`ghostButton`, hauteur visible d'environ 32 px avec zone de tap étendue), `MenuFeuille.tsx:98` (`h-11 w-11`).
- Scénario : deux boutons voisins de hauteurs visibles différentes, alignés par le centre : le plus petit paraît flotter. Alignement optique à corriger.
- Axe violé : Constraints (cohérence des contrôles) ; Tone (calme visuel).
- Correctif proposé : aligner sur le gabarit du système : `h-9` visible avec `zoneTap44` pour le menu, ou `min-h-11` flex pour « Relire ».
- Correctif sûr : oui.

### M5. Tailles de texte arbitraires au lieu des jetons nommés
- Fichiers : `FeuilleView.tsx:373`, `BarreOutils.tsx:130`, `CalendrierView.tsx:91` (`text-sm`).
- Scénario : le reste du module utilise `text-label`, `text-small`, `text-body` ; ces trois endroits retombent sur la valeur Tailwind par défaut (14 px, soit la même taille que `text-label`).
- Axe violé : Constraints (jetons typographiques de `DESIGN.md`).
- Correctif proposé : `text-label`.
- Correctif sûr : oui (même rendu).

### M6. Calendrier : le jour courant n'est pas repéré
- Fichier : `CalendrierView.tsx:101-117` (`jour === aujourdhui` ne sert qu'à choisir le lien).
- Scénario : on ouvre « Relire » pour retrouver la soirée d'hier ou d'aujourd'hui ; rien ne distingue la case du jour parmi les cases vides. Seuls les soirs écrits ressortent (fond `surface`, pastille ou vignette).
- Axe violé : Purpose (consulter en quelques secondes) ; Memorable detail.
- Correctif proposé : `ring-1 ring-kcal` (ou chiffre en gras `text-ink`) sur la case du jour, plus `aria-current="date"` sur le lien.
- Correctif sûr : oui.

### M7. Calendrier : le squelette réapparaît à chaque changement de mois
- Fichiers : `CalendrierView.tsx:31-43` (clé dépendant de `mois`, pas de données conservées), `:87-88` (squelette de 288 px, alors que la grille fait environ 400 px).
- Scénario : on parcourt les mois précédents avec la flèche : grille puis squelette puis grille, avec saut de hauteur et clignotement à chaque appui. Le staleTime à 0 (voir audit perf M6) aggrave l'attente.
- Axe violé : Tone (animations discrètes, pas de scintillement) ; Purpose (parcourir vite).
- Correctif proposé : `placeholderData: keepPreviousData` (TanStack) et grille atténuée pendant le chargement ; réserver la hauteur du squelette sur celle d'une grille de 6 lignes.
- Correctif sûr : oui.

### M8. Rayon non concentrique de la pastille du numéro de jour
- Fichier : `CalendrierView.tsx:124` (`rounded-md`, 6 px) à l'intérieur de la case `rounded-xl` (12 px) avec `p-1` (4 px).
- Scénario : le rayon intérieur devrait valoir 12 − 4 = 8 px ; à 6 px, la pastille « flotte » dans le coin de la vignette.
- Axe violé : Constraints (Escalating Round Rule) ; checklist de finition no 1.
- Correctif proposé : `rounded-lg`.
- Correctif sûr : oui.

### M9. Titre du squelette différent du titre de l'écran
- Fichiers : `FeuilleChargement.tsx:8` (toujours « Journal »), `loading.tsx`, `[jour]/page.tsx:30` (fallback commun), alors que `FeuilleView.tsx:340` affiche « Feuille du soir » pour un jour passé et que `calendrier/page.tsx:21` affiche « Relire ».
- Scénario : ouvrir une soirée passée depuis le calendrier montre « Journal », puis le titre change à l'arrivée du contenu ; idem entre l'écran de chargement racine et « Relire ».
- Axe violé : Tone (calme, pas de saut de titre) ; Constraints (squelettes qui reflètent l'écran).
- Correctif proposé : passer le titre en prop de `FeuilleChargement` (« Feuille du soir » côté `[jour]`), ou une variante sans titre.
- Correctif sûr : oui.

### M10. « Écrire aussi au doigt » : le libellé n'est pas une zone de tap
- Fichier : `FeuilleView.tsx:372-375` (`<span>` visible puis `Switch` avec le même `aria-label`).
- Scénario : on touche le texte pour activer l'option ; rien ne se passe, seule la piste de 44 px répond. Le libellé est dupliqué (visible et accessible) sans lien programmatique.
- Axe violé : Memorable detail (zone de tap) ; Constraints (réutiliser `Switch` avec son libellé).
- Correctif proposé : envelopper la ligne dans un `<label>` associé au bouton, ou faire du texte un `<button>` qui appelle le même `onToggle`.
- Correctif sûr : oui.

### M11. « Effacer la feuille » : confirmation modale pour une action pourtant annulable
- Fichier : `FeuilleView.tsx:231-237, 397-406` (le texte du dialogue rappelle que « Annuler » ramène la feuille).
- Scénario : l'utilisateur doit confirmer un effacement qu'il peut ensuite annuler d'un tap. `ConfirmDialog` est prévu pour ce qu'un toast « Annuler » ne rattrape pas ; et la phrase « Tu pourras revenir en arrière avec Annuler » oblige à lire un message long dans un dialogue pour un geste rare. Hors de l'écran, l'annulation n'existe plus (la feuille vide est envoyée au serveur).
- Axe violé : Memorable detail (annulation) ; Tone (peu de friction, retour immédiat).
- Correctif proposé : effacer tout de suite avec un toast « Feuille effacée » + action « Annuler » (le composant de toast gère déjà une action), en gardant la confirmation seulement si la feuille a déjà été synchronisée et que l'on quitte l'écran.
- Correctif sûr : non (change le parcours ; à valider avec Vincent).

---

## Options structurantes (non appliquées)

- **O1. Sortir « Écrire aussi au doigt » de l'écran principal.** C'est un réglage rare qui occupe une ligne de 44 px au-dessus de la feuille, au prix de la surface d'écriture. Le déplacer dans le menu « … » (avec l'état affiché) ou dans un réglage du module. Avec le rappel de statut remonté (I2), l'en-tête gagnerait une ligne nette.
- **O2. En-tête repliable pendant l'écriture.** Titre, date, contrôle Stylo/Clavier, bouton « Relire » et menu occupent environ 200 px avant la feuille. Un en-tête compact dès qu'un trait est posé (réaffiché au défilement vers le haut) rendrait plus de surface au S Pen.
- **O3. Garder la vue montée sous l'écran de verrouillage.** Rendre le verrou comme un calque au-dessus de `FeuilleView` (au lieu de la remplacer) conserverait brouillon clavier et proposition de transcription (I3). Touche le verrou : décision de sécurité, à valider ; ne pas conserver le contenu visible sous le calque.
- **O4. Lecture biométrique déclenchée à l'ouverture.** Aujourd'hui : ouvrir le Journal puis toucher « Déverrouiller » à chaque session (`VerrouGate.tsx:111-139, 186-195`). Lancer `startAuthentication` dès l'arrivée supprimerait un tap sur le geste le plus fréquent, avec repli sur le bouton si le navigateur exige un geste. Touche le verrou : à décider, non appliqué.
- **O5. Ouverture à froid hors ligne.** Le garde de verrou exige le serveur pour ouvrir le module (`VerrouGate.tsx:47-55, 145-155` : « Impossible de joindre le serveur »), alors que la feuille est conçue pour s'écrire hors ligne (`local.ts`). L'audience écrit parfois sans réseau : un déverrouillage local de l'appareil donnerait l'accès à la seule écriture locale. Décision de sécurité, hors périmètre de cet audit.

---

## Déjà couvert par l'audit du 2026-11-07 (cité, non refait)

- **Critique C-1 (parcours)** : `FeuilleView.tsx:102-116, 165-180`, `local.ts:93-103, 147-150`. Une feuille ouverte vide après un timeout de 4 s (source « vide » confondue avec « inconnue ») peut écraser la feuille serveur à la synchro. Vérifié : le code lu est inchangé (`chargerServeur` renvoie `null` au timeout, `choisirFeuille` renvoie `source: "vide"`), le constat reste ouvert et reste prioritaire sur tout ce qui précède.
- **I3 (accessibilité)** : fermeture de `Modal` au tap sur le fond. S'applique à `TranscriptionDialog` : une proposition corrigée à la main se perd sur un tap hors de la feuille (le mode « texte » enregistre à la fermeture, donc sans perte).
- **M-13 (parcours)** : `TranscriptionDialog` et `ConfirmDialog` sans entrée d'historique, donc le retour système quitte la page au lieu de fermer la boîte.
- **Perf M6** : `staleTime: 0` + `refetchOnMount: "always"` sur `CalendrierView.tsx:41` (second aller-retour à l'ouverture) ; **perf M3** : `<img>` natif des vignettes `CalendrierView.tsx:122` justifié (URL signées d'un bucket privé).
- **Qualité 8** : `.catch(() => undefined)` de `VerrouGate.tsx:94`.
- **A11y M1** : absence de lien d'évitement (vaut pour tout le module).
- Non retenu car conforme : zones de tap du menu (44 px) et de la barre d'outils, `aria-label` des contrôles, `aria-expanded`/Échap/flèches du menu, `prefers-reduced-motion` sur les rotations, écrans immersifs sans barre du bas (`immersif.ts`), `Switch` à zone étendue, champ de code en `type="password"` libellé.
