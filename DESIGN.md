---
name: Kilio
description: App personnelle mono-utilisateur (nutrition, budget, agenda, courses, habitudes...) — mobile d'abord, ton "tableau de bord doux"
colors:
  primary: "oklch(0.55 0.14 165)"
  primary-soft: "oklch(0.55 0.14 165 / 0.12)"
  macro-protein: "oklch(0.55 0.13 265)"
  macro-carbs: "oklch(0.58 0.14 85)"
  macro-fat: "oklch(0.56 0.15 340)"
  warning: "oklch(0.6 0.15 55)"
  alert: "oklch(0.55 0.19 25)"
  background: "oklch(0.97 0.012 95)"
  surface: "oklch(0.995 0.006 95)"
  surface-alt: "oklch(0.935 0.012 95)"
  line: "oklch(0.9 0.012 95)"
  ink: "oklch(0.22 0.02 150)"
  ink-2: "oklch(0.5 0.018 150)"
  ink-3: "oklch(0.55 0.014 150)"
  on-kcal: "oklch(1 0 0)"
  on-accent: "oklch(1 0 0)"
  control-border: "oklch(0.64 0.012 150)"
  module-agenda: "oklch(0.55 0.14 230)"
  module-budget: "oklch(0.55 0.14 65)"
  module-habitudes: "oklch(0.55 0.14 45)"
  module-courses: "oklch(0.55 0.14 305)"
  module-objectifs: "oklch(0.55 0.14 200)"
  module-collection: "oklch(0.55 0.14 280)"
  module-carburants: "oklch(0.55 0.14 120)"
  module-documents: "oklch(0.55 0.14 25)"
  module-planning-travail: "oklch(0.38 0.09 150)"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui"
    fontSize: "0.78125rem"
    fontWeight: 600
    lineHeight: 1.3
  mono:
    fontFamily: "ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  xs: "12px"
  sm: "16px"
  md: "20px"
  lg: "22px"
  xl: "24px"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-kcal}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-primary-disabled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-kcal}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-tight:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px"
  input:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  chip:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: Kilio

## Overview

**Creative North Star: "Le Tableau de Bord Doux"**

Kilio est l'app personnelle de Vincent : un tableau de bord de vie quotidienne (nutrition, budget, agenda, courses, habitudes, tâches...) pensé pour être rouvert plusieurs fois par jour, sur téléphone, sans jamais fatiguer. L'interface ne cherche pas à impressionner : elle cherche à rester **lisible, calme et instantanément familière**, avec juste assez de mouvement et de douceur pour rendre le quotidien agréable. Tout est arrondi, tout est feutré — un fond ivoire chaud, une encre presque noire teintée de vert olive (écho direct du logo « K »), et une unique couleur d'accent franche qui sert de fil rouge dans toute l'app.

La densité d'information reste modérée : une carte = une idée (un repas, une tâche, une transaction), jamais un tableau dense. Les micro-interactions (pastille active qui glisse dans la barre du bas, transitions de page directionnelles, suppression optimiste avec sortie animée) donnent à l'app une sensation d'app native, alors qu'elle est servie en PWA.

**Key Characteristics:**
- Palette OKLCH entièrement teintée : même les neutres (`ink`, `ink-2`, `ink-3`) portent une pointe de vert, rien n'est gris pur.
- Une seule couleur d'accent "brand" (le vert `--accent-kcal`) porte toute l'interaction primaire ; les autres teintes sont strictement sémantiques (macro, alerte) ou identitaires par module.
- Coins très arrondis partout, avec un rayon qui grandit avec la taille du conteneur (boutons < lignes de liste < cartes hero < barre de nav).
- Plat au repos, une seule ombre douce et ambiante pour signaler "ceci est une carte" — jamais d'ombre dure.
- Deux polices seulement : Sora (display, titres et chiffres-clés) et Inter (tout le reste).

## Colors

Palette OKLCH entièrement teintée verte, construite autour d'un unique accent "brand" et de teintes strictement sémantiques.

### Primary
- **Vert Olive Kcal** (`oklch(0.55 0.14 165)`, ≈ `#1f9e6e`) : seule couleur "brand"/interactive de l'app — boutons primaires, onglet actif de la nav, anneau de focus, anneau de progression calorique. **The One Accent Rule.** Aucun autre composant interactif (bouton, lien, état actif) n'utilise une autre teinte que celle-ci ; les couleurs de module et de macro restent des indicateurs passifs, jamais des CTA.
- **Vert Olive Kcal Doux** (`oklch(0.55 0.14 165 / 0.12)`) : fond du pastille active en barre de navigation et du tag kcal — jamais utilisé comme fond de bouton plein.

### Secondary — Triade Macro
- **Bleu Protéines** (`oklch(0.55 0.13 265)`) : barre de progression et libellé "Protéines" uniquement.
- **Jaune Glucides** (`oklch(0.58 0.14 85)`) : barre de progression et libellé "Glucides" uniquement.
- **Magenta Lipides** (`oklch(0.56 0.15 340)`) : barre de progression et libellé "Lipides" uniquement.

### Tertiary
- **Ambre Avertissement** (`oklch(0.6 0.15 55)`) : dépassement léger d'un objectif nutritionnel (≤10% au-delà de la cible kcal ou macro) — ton informatif, jamais alarmant. N'est utilisé nulle part ailleurs que ce cas précis.
- **Rouge Alerte** (`oklch(0.55 0.19 25)`) : dépassement net d'un objectif (>10% au-delà de la cible), texte et bouton "Supprimer" uniquement. Un dépassement léger passe par l'Ambre Avertissement ci-dessus, pas directement par le rouge — voir The Graduated Alert Rule.

### Neutral
- **Fond Ivoire Chaud** (`oklch(0.97 0.012 95)`, teinte 95 = légèrement jaune) : fond de page.
- **Surface** (`oklch(0.995 0.006 95)`) : fond des cartes, quasi blanc mais jamais blanc pur.
- **Surface Alt** (`oklch(0.935 0.012 95)`) : fond des inputs, segmented control, pastilles/chips — un cran plus sombre que la carte.
- **Ligne** (`oklch(0.9 0.012 95)`) : bordures hairline (1px) des cartes et inputs.
- **Encre** (`oklch(0.22 0.02 150)`, teinte 150 = vert) : texte principal — pas de noir pur, toujours teinté vert comme le logo.
- **Encre 2 / Encre 3** (`oklch(0.5 0.018 150)` / `oklch(0.55 0.014 150)`) : texte secondaire et tertiaire (labels, meta, placeholders). Encre 3 a été assombrie en septembre 2026 (0,64 → 0,55 en clair, 0,54 → 0,64 en sombre) pour passer ≥ 4,5:1 sur `surface` ; elle ne descend jamais sous 11px.
- **Bordure de contrôle** (`--control-border`, `oklch(0.64 0.012 150)` / sombre `oklch(0.54 0.02 195)`) : contour des contrôles non textuels à l'état « off » (cercle non coché de `CheckToggle`, piste d'interrupteur éteint) — ≥ 3:1 sur `surface`. `--line` reste réservé aux séparations décoratives.

### Texte sur accent
- **`--on-kcal`** : texte et icône posés sur un fond `--accent-kcal` plein (bouton primaire, segment actif, FAB). Blanc en clair, encre très sombre (`oklch(0.17 0.02 165)`) en sombre — le blanc sur le vert sombre ne fait que 2,3:1. Classe `text-on-kcal`.
- **`--on-accent`** : même règle pour tout autre fond d'accent plein (icône « + » des cartes d'ajout, pastille d'alerte, coche d'un `CheckToggle` coloré). Classe `text-on-accent`.
- **`--on-agenda`** : variante historique de l'Agenda, même principe.
- Ne jamais écrire `text-white` sur un fond d'accent : il échoue en thème sombre.

### Module Accents (optional)
Chaque module a sa propre teinte identitaire (agenda `230`, budget `65`, habitudes `45`, courses `305`, objectifs `200`, collection `280`, carburants `120`, documents `25`, planning-travail `150` foncé), toutes construites avec la même formule `oklch(0.55 0.14 <hue>)` que le vert Kcal — seule la teinte change. Elles servent uniquement à colorer l'icône/l'identité de leur module dans la grille d'accueil et le sélecteur "Plus" ; elles ne remplacent jamais le vert Kcal comme couleur interactive à l'intérieur d'un module.

### Note Tints (optional)
Huit teintes pastel très claires (`--note-sauge`, `--note-peche`, `--note-lavande`, `--note-ciel`, `--note-rose`, `--note-citron`, `--note-menthe`, `--note-argile`) réservées aux fonds de note du module Notes — hors périmètre du Journal Nutrition, listées ici pour mémoire de complétude du système.

### Named Rules
**The One Accent Rule.** Le vert Kcal est la seule couleur autorisée pour un élément interactif primaire (bouton plein, lien, focus ring, onglet actif), quel que soit le module affiché.
**The Semantic-Only Macro Rule.** Bleu/Jaune/Magenta ne désignent jamais rien d'autre que Protéines/Glucides/Lipides — jamais réutilisées comme couleurs décoratives ailleurs.
**The Graduated Alert Rule.** Un dépassement d'objectif (nutritionnel ou budgétaire) n'est jamais binaire : léger (≤10% au-delà de la cible) passe par l'Ambre Avertissement, net (>10%) par le Rouge Alerte. Le rouge — partagé avec les actions destructives — ne s'applique qu'aux dépassements qui le méritent vraiment, pour ne pas transformer un usage quotidien en cadrage anxiogène. Budget : une catégorie « proche » de sa cible passe en Ambre Avertissement, « dépassée » en Rouge Alerte (plus de jaune Glucides).

### Exceptions assumées
Écarts volontaires aux règles ci-dessus, documentés pour ne pas être « corrigés » par erreur :
- **Agenda** : le bleu `--accent-agenda` sert de couleur interactive **à l'intérieur de l'Agenda uniquement** (sélecteur Jour/Semaine/Mois glissant, FAB, anneau de focus des blocs, « Aujourd'hui »), avec `--on-agenda` pour le texte posé dessus. Motif : l'Agenda superpose tâches, planning de travail et créneaux, et le bleu y distingue l'action du contenu. Aucun autre module n'a cette exception.
- **Échelle de priorité des tâches** : les badges et blocs de priorité (basse / moyenne / haute) utilisent `agenda` / `carbs` / `alert` en **teinte de fond à 10-15 %**, toujours doublée d'un marqueur non chromatique (glyphe ou libellé). Ce sont des indicateurs passifs, jamais des contrôles ; le sélecteur de priorité, lui, est un contrôle segmenté standard (actif en vert Kcal).
- **Barre de navigation** : les labels de la barre du bas sont en 11px (plancher du système).
## Typography

**Display Font:** Sora (600/700/800), fallback `ui-sans-serif, system-ui`
**Body Font:** Inter (400/500/600/700), fallback `ui-sans-serif, system-ui`
**Label/Mono Font:** monospace système (`font-mono` Tailwind par défaut), pour les valeurs chiffrées alignées (ex. `120 / 150 g`)

**Character:** Sora est géométrique et ferme, réservée à ce qui doit "peser" visuellement : titres d'écran et chiffres-clés (kcal consommées, kcal par repas). Inter porte tout le reste — labels, corps de texte, boutons — pour rester neutre et très lisible en petite taille sur mobile.

### Hierarchy
- **Display** (600, 28px / 1.1, tracking −0,03em) : `screenTitle` — titre d'écran ("Journal"), et chiffres-clés isolés (kcal restantes au centre de l'anneau, kcal d'une entrée de repas).
- **Title** (700, 15px) : `sectionTitle` — titres de section ("Résumé du jour", "Repas du jour").
- **Body** (600, 14.5px) : nom d'une entité dans une liste (nom d'un repas, d'une tâche).
- **Label** (600, 12.5–13.5px) : `eyebrow` (date du jour, contexte), onglets de sous-nav.
- **Caption** (400–600, 11–12px) : `metaText`/meta (détail de quantité, libellés de moment de repas en majuscules espacées, labels de la barre de nav du bas). **Plancher : 11px** pour tout texte lisible. Seules exceptions : les grilles denses de l'Agenda et du calendrier Budget (9-10px, texte `ink-2`) et les pastilles blanches sur photo (fond noir, contraste élevé).
- **Champs de saisie** : 16px minimum (en dessous, iOS zoome la page au focus) ; un filet global dans `globals.css` l'impose sur écran tactile.

**Échelle observée** (toutes ces tailles sont légitimes) : 11 · 12 · 12,5 · 13 · 13,5 · 14 · 14,5 · 15 · 16 · 17 (titres de carte hero) · 22 (chiffre-clé de carte) · 28px (titre d'écran et chiffre-clé hero).

### Named Rules
**The Two-Voice Rule.** Une app entière tient sur deux polices : Sora uniquement pour les titres et les chiffres qui doivent dominer visuellement, Inter pour absolument tout le reste. Aucune troisième police, aucune variation de graisse Sora en dessous de 600.

## Layout

Mobile d'abord et quasi exclusivement : conteneur unique en colonne (`flex flex-col`), pas de grille multi-colonnes sur les écrans de contenu — le desktop n'est pas un layout cible distinct. Rythme vertical par `gap` Tailwind : `gap-5` (20px) entre grandes sections d'écran (nav secondaire / résumé / liste), `gap-2` à `gap-3` (8–12px) entre éléments d'une même liste, `gap-1.5` (6px) pour les groupes très rapprochés (label + valeur). Padding interne des cartes : 14–18px selon la taille de la carte.

Motifs récurrents de composition :
- **Contrôle segmenté** (pilule `surface-alt` contenant des onglets `rounded-xl` dont l'actif passe en fond `bg-kcal` plein, texte `--on-kcal` ; composant `<SegmentedControl>`) : utilisé aussi bien pour la sous-nav Journal/Recettes que pour le toggle Repos/Entraînement — c'est le motif de choix binaire/multiple de tout le système, jamais de radio ou dropdown à sa place.
- **Barre de navigation flottante** : pilule détachée du bord de l'écran (padding horizontal + `bottom` respectant `env(safe-area-inset-bottom)`), fond flouté (`backdrop-blur-xl`) semi-transparent, jamais collée en pleine largeur.
- **Navigation directionnelle** : chaque changement d'écran (bottom nav, jour précédent/suivant) déclenche une View Transition en glissement horizontal (~200ms, easing `ease-out`) dont le sens dépend de la position relative dans la hiérarchie de nav — jamais un simple fondu par défaut si un sens est connu.
- `prefers-reduced-motion: reduce` est systématiquement respecté (règle globale + `MotionConfig`) : toutes les animations (glissements, pastille de nav, halo de mise en surbrillance) sont neutralisées à ~0ms plutôt que supprimées au cas par cas.

## Elevation & Depth

Système **plat avec un soulèvement doux** : aucune interface n'est "posée" en couches multiples, une seule ombre existe dans tout le système (`--shadow-card`), appliquée uniformément à toute carte/pilule flottante pour signaler juste "ceci est un élément détaché du fond" — jamais pour créer une hiérarchie de profondeur entre plusieurs niveaux. La séparation entre zones vient d'abord de la couleur de fond (`background` vs `surface` vs `surface-alt`) et de bordures hairline `--line` (1px), pas de l'ombre.

### Shadow Vocabulary
- **Card** (clair : `0 1px 2px oklch(0.3 0.03 150 / 0.05), 0 8px 24px -10px oklch(0.3 0.03 150 / 0.12)` ; sombre : reflet `0 1px 0 oklch(1 0 0 / 0.04) inset` + `0 10px 28px -10px rgba(0,0,0,0.55)`) : seule ombre du système — cartes, barre de navigation flottante, tout élément "détaché" du fond de page.

### Named Rules
**The Single Shadow Rule.** Un seul token d'ombre existe (`--shadow-card`). Ne jamais en introduire un second (pas d'ombre "hover" ou "elevated" distincte) : l'élévation dans Kilio est binaire — posé sur le fond, ou détaché avec `--shadow-card`.

## Shapes

Le langage de forme est délibérément très arrondi, en écho au squircle du logo "K" : aucun coin vif nulle part dans l'app. Le rayon **augmente avec la taille du conteneur** plutôt que d'être uniforme :
- 12px : petits boutons secondaires (ghost, danger), boutons icône.
- 16px : boutons pleins (primaire/secondaire), champs de saisie, contrôle segmenté.
- 20px : lignes de liste denses (`cardTight`, `listCard`) — une entité par ligne.
- 22px : cartes standard et cartes "ajouter" (`card`, `addCard`).
- 24px : carte "hero" (résumé du jour), grands conteneurs mis en avant.
- 26px : conteneur de la barre de navigation flottante — le plus grand rayon du système.
- Plein (`rounded-full`) : badges/chips, pastilles de tag, cercle de progression, avatar-like `checkCircle`.

Bordures : hairline 1px `--line` sur quasi tout élément de surface (cartes, inputs, boutons secondaires) — jamais de bordure épaisse ni de double bordure.

### Named Rules
**The Escalating Round Rule.** Le rayon d'un élément suit la taille de son conteneur, pas un rayon fixe unique : plus la surface est grande/englobante, plus le coin est arrondi (12px → 26px), jusqu'au plein cercle pour les éléments ponctuels (tags, avatars, anneaux).

## Components

### Buttons
- **Shape:** 16px (`rounded-2xl`) pour primaire/secondaire pleine taille ; 12px (`rounded-xl`) pour ghost/danger/icône compacts.
- **Primary:** fond `--accent-kcal` plein, texte `--on-kcal`, `active:scale-[0.97]` au tap, `disabled:opacity-60`.
- **Secondary:** fond `surface`, bordure `line`, texte `ink` — même géométrie et même feedback tap que le primaire.
- **Ghost / Danger / Link:** sans fond (ou fond transparent avec hover `surface-alt`), texte `ink` (ghost), `alert` (danger) ou `kcal` (link) ; toujours le même `active:scale-[0.97]`.
- **Focus:** anneau `focus-visible:ring-2 ring-kcal ring-offset-2` — jamais sur simple `focus`/clic souris, toujours détaché du fond par l'offset.
- **Cible tactile : 44px minimum.** Les boutons compacts (`ghostButton`, `dangerButton` ≈ 32px, `iconButton` 36px) gardent leur taille visible mais portent une zone de tap étendue (pseudo-élément `after:`) jusqu'à 44px ; `navArrowButton` fait 44×44px en propre.

### Chips / Pills
- **Style:** fond `surface-alt`, texte `ink-2`, entièrement arrondi, 11px semibold — usage neutre (tag générique).
- **Variante Kcal:** fond `--accent-kcal-soft` (12% d'opacité), texte `kcal` — réservée aux tags portant une valeur calorique.

### Cards / Containers
- **Corner Style:** 20–24px selon densité (voir Shapes).
- **Background:** `surface`, bordure hairline `line`.
- **Shadow Strategy:** `--shadow-card` uniquement (voir Elevation & Depth).
- **Internal Padding:** 14px (dense/liste) à 18px (hero).
- **Feedback tap:** les cartes "ligne de liste unique" (`cardTight`, `listCard`) ont un `active:scale-[0.97]` ; les cartes "conteneur de groupe" (plusieurs enfants indépendants) n'en ont volontairement pas, pour ne pas faire "trembler" tout un groupe au tap d'un enfant.

### Inputs / Fields
- **Style:** fond `surface-alt`, bordure `line`, 16px de rayon, texte 16px.
- **Focus:** bordure `kcal/60` + même anneau `focus-visible` que les boutons.
- **Erreur:** texte `alert`, `role="alert"` sous le champ concerné (pas de bordure rouge sur le champ lui-même dans le code observé).

### Navigation
- **Barre du bas :** pilule flottante flou verre (`backdrop-blur-xl`, fond `--nav-bg` translucide), items icône + label 11px, pastille de fond active (`--accent-kcal-soft`) qui **glisse** (layout animation Framer Motion) d'un onglet à l'autre plutôt que d'apparaître/disparaître.
- **Contrôle segmenté — composant unique `<SegmentedControl>`** (`src/components/SegmentedControl.tsx`) : pilule `surface-alt`, segments `rounded-xl` de 44px de haut, actif en fond `kcal` + `text-on-kcal`, `aria-pressed`, anneau de focus, option `glissant` (pastille animée). Les variantes « lien » (sous-navigation Journal/Recettes, bascule Repos/Entraînement) réutilisent `SEGMENT_CADRE` et `segmentClasse()` (`src/lib/segmented.ts`). Tout choix à 2-4 options passe par lui — jamais un `<select>`, jamais une couleur de module pour l'actif.
- **États :** actif = couleur `kcal` + `font-weight: 700` ; inactif = `ink-3` + `font-weight: 500`. Toujours `aria-current="page"` sur l'item actif.

### Progress (signature)
- **Anneau circulaire** (SVG, `stroke-dasharray`/`dashoffset` animés par `transition-[width]`/directement en style) : progression calorique du jour, piste `surface-alt`, tracé `accent-kcal` (ou `accent-alert` si dépassé), embout arrondi (`strokeLinecap="round"`), chiffre `font-display` au centre.
- **Barre linéaire fine** (1.5px de hauteur, `rounded-full`) : une par macro (protéines/glucides/lipides), même logique de dépassement → bascule vers `accent-alert`.

## Do's and Don'ts

### Do:
- **Do** réserver `--accent-kcal` (vert) à l'interaction primaire et à l'identité générale de l'app — c'est la seule couleur "cliquable" par défaut.
- **Do** garder les neutres teintés vert OKLCH (`ink`/`ink-2`/`ink-3`/`background`/`surface`) plutôt que d'introduire du gris pur ou un autre hex de neutre.
- **Do** faire grandir le rayon avec la taille du conteneur (12px boutons → 26px barre de nav → plein cercle pour badges/anneaux).
- **Do** utiliser `focus-visible` (jamais `focus`) pour l'anneau de focus clavier, avec `ring-offset-2` pour qu'il reste visible sur fond `kcal`.
- **Do** neutraliser toute animation via `prefers-reduced-motion: reduce` plutôt que de la retirer composant par composant : c'est fait globalement (règle `*` dans `globals.css` pour le CSS, `<MotionConfig reducedMotion="user">` dans `providers.tsx` pour framer-motion).
- **Do** rendre les dialogues via `Modal` (portal, focus piégé, Échap) et les overlays plein écran dans un `Portal`.
- **Do** utiliser Sora exclusivement pour les titres d'écran et les chiffres-clés qui doivent dominer visuellement ; Inter pour tout le reste.

### Don't:
- **Don't** introduire une deuxième couleur "brand"/interactive à côté du vert Kcal — les couleurs de macro et de module restent des indicateurs passifs.
- **Don't** ajouter une ombre plus dure ou un second niveau d'ombre : le système n'a qu'un seul token d'élévation (`--shadow-card`).
- **Don't** utiliser un coin vif (radius 0) ou un rayon uniforme sur tous les composants, quelle que soit leur taille.
- **Don't** ajouter `active:scale` à une carte "conteneur de groupe" englobant plusieurs éléments indépendants (formulaires, sections listant plusieurs entités) — réservé aux cartes représentant une entité unique.
- **Don't** utiliser une police tierce ou une graisse Sora sous 600 : la hiérarchie typographique du système repose sur seulement deux familles et une plage de graisses restreinte.
