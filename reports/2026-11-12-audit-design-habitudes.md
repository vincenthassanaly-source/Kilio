# Audit design du module Habitudes (2026-11-12)

Lecture seule, selon `reports/2026-11-12-brief-design.md` (5 axes, trois passes). Fichiers : `src/app/(app)/habitudes/*`, `src/app/(app)/DashboardHabitItem.tsx`, `src/components/CheckToggle.tsx` et `ProgressRing.tsx` (non utilisé ici), `src/lib/ui.ts`. Aucun build, lint ni test lancé ; contrastes calculés à la main depuis les tokens de `globals.css`.

## Résumé

- Le geste le plus fréquent (cocher) fonctionne bien (optimiste, rollback, file hors ligne), mais sa zone de tap (34 px), son état « non coché » (anneau à 1,2:1) et son nom accessible sont en dessous du niveau des autres modules.
- La saisie des habitudes quantifiées (« verres d'eau ») demande un champ numérique, un blur pour valider et ne réagit pas à Entrée : le geste le plus lent du module.
- L'Historique est la zone la plus faible : contraste insuffisant en thème sombre, état « fait » transmis par la seule couleur, aucun état de chargement ni d'erreur (grille vide = impression d'échec).

## Critique

Aucun.

## Important

### I1. Zone de tap de la coche : 34 px, sans extension
- `HabitudeCard.tsx:179-196` : `ProgressRing size={34}` contient le `<button className="h-full w-full">`. Aucun `hitSlop` ni `zoneTap44`, alors que `CheckToggle` étend à 44 px (`CheckToggle.tsx:10-19, 52`) et que le tap sur l'accueil mesure 60 × 50.
- Scénario : d'une main, sur téléphone, cocher « Boire de l'eau » ; l'anneau fait 34 px, la marge autour est un `gap-3`. Les ratés sont fréquents sur le geste le plus répété du module.
- Axe : Memorable detail (zone tactile du geste principal) ; WCAG 2.5.8 respecté (≥ 24 px) mais pas la cible 44 px du brief.
- Correctif : overlay `absolute` `inset: -5px` (10 px de plus = 44 px) dans le bouton, comme `CheckToggle` ; l'espace entre cartes (`gap-2.5`) et la colonne de texte voisine suffisent à éviter un chevauchement. Correctif sûr : oui.

### I2. État « non coché » quasi invisible (anneau gris sur gris)
- `HabitudeCard.tsx:179` (et `DashboardHabitItem.tsx:88`) : `ProgressRing` garde `trackColor="var(--surface-alt)"` par défaut (`ProgressRing.tsx:9`). `surface-alt` sur `surface` = 1,19:1 (calcul), alors que `--control-border` (≥ 3:1) a été créé pour « le cercle non coché de `CheckToggle` » (`DESIGN.md`). Sans icône (`habitude.icone` vide, `:193` rend une chaîne vide), le contrôle est un disque presque transparent, sans signe qu'on peut taper.
- Scénario : habitude sans emoji, thème clair ou sombre : on ne voit pas qu'il y a un bouton à cocher.
- Axe : Constraints (token `--control-border`, composant `CheckToggle`) ; WCAG 1.4.11.
- Correctif : pour les types non quantifiés, passer `trackColor="var(--control-border)"` ; pour une icône vide, afficher un point ou `CheckIcon` en `ink-3` (comme `DashboardHabitItem.tsx:89`). Correctif sûr : oui.

### I3. Nom accessible de la coche sans le nom de l'habitude
- `HabitudeCard.tsx:185` : `aria-label={fait ? "Marquer non fait" : "Marquer fait"}`. Avec N habitudes, le lecteur d'écran (ou la commande vocale) ne trouve que N boutons identiques ; `CheckToggle` prévoit `describedBy` exactement pour ça (`CheckToggle.tsx:38`). Le bouton ne porte pas `aria-pressed`, contrairement à l'accueil (déjà corrigé, voir plus bas).
- Axe : Constraints (patron `CheckToggle` : `aria-pressed` + `aria-describedby`) ; WCAG 4.1.2, 2.5.3.
- Correctif : `aria-label={`${habitude.nom}`}` + `aria-pressed={fait}` (nom stable, état annoncé), ou garder le libellé d'action et ajouter `aria-describedby` vers l'id du `<p>` du nom (`:200`). Correctif sûr : oui.

### I4. Habitudes quantifiées : saisie lente, Entrée ne valide pas
- `HabitudeCard.tsx:227-238` : champ numérique qui n'enregistre qu'au `onBlur` (`:235`). Aucun `onKeyDown` Entrée, aucun `enterKeyHint`, aucun formulaire : sur le clavier numérique mobile, la touche de validation ne fait rien tant qu'on ne touche pas ailleurs. Hauteur du champ ≈ 37 px (`input` `py-1.5`, `text-base`). Le bouton de coche est absent pour ce type (`:180`) et l'accueil le désactive (`DashboardHabitItem.tsx:83`) : seul chemin possible.
- Scénario : après le 3e verre d'eau, ouvrir /habitudes, taper le champ, saisir « 3 », puis taper à côté pour valider ; si l'utilisateur quitte l'écran sans cela, la valeur est perdue sans signal.
- Axe : Memorable detail (geste fréquent d'un module) et Purpose (secondes, une main).
- Correctif : `onKeyDown` Entrée → `e.currentTarget.blur()` et `enterKeyHint="done"` ; porter la hauteur à 44 px (`py-2.5` ou zone de tap). Correctif sûr : oui. Le pas +/- est une option structurante (voir plus bas). L'hors ligne de ce champ est déjà au rapport I-11.

### I5. Historique : texte illisible en thème sombre sur les jours complets
- `HistoriqueView.tsx:138-149` : fond `color-mix(accent-habitudes, 15 + ratio × 70 %)` avec texte `text-ink`. Contrastes calculés : clair 5,4:1 (jour complet, limite), sombre 2,6:1 (jour complet) et 3,9:1 (ratio 0,5), sous 4,5:1 pour du texte de 13 px (`text-small`).
- Scénario : la nuit, ouvrir l'Historique d'une habitude bien suivie : les chiffres des jours réussis sont pâles sur orange clair.
- Axe : Tone (lisible, calme) ; WCAG 1.4.3.
- Correctif : plafonner l'opacité en sombre (ex. `15 + ratio × 45`) ou poser le texte en `text-on-accent` / `ink` assombri au-delà de ratio 0,5 ; vérifier les 4,5:1 sur les deux thèmes. Correctif sûr : oui (visuel seul).

### I6. Historique : l'état d'un jour n'existe que par la teinte
- `HistoriqueView.tsx:135-153` : chaque jour est un `<div>` avec un nombre ; fait / partiel / non fait n'est exprimé que par la couleur de fond, « aujourd'hui » que par la couleur de bordure (`:138`). `title={iso}` (`:137`) affiche une date ISO brute, inutile au tactile et pour les lecteurs d'écran. Pour une quantifiée, la valeur du jour n'est lisible nulle part.
- Scénario : lecteur d'écran ou daltonisme : la grille se lit « 1, 2, 3 ... » ; en tactile, impossible de savoir combien de verres le 8.
- Axe : Purpose (consulter en quelques secondes) ; WCAG 1.4.1, 1.3.1.
- Correctif : ajouter un `<span className="sr-only">` (« fait » / « 3 sur 8 ») dans chaque cellule, `aria-current="date"` sur aujourd'hui, retirer ou formater le `title`. Correctif sûr : oui.

### I7. Historique : aucun état de chargement ni d'erreur (grille vide = « rien fait »)
- `HistoriqueView.tsx:48-52` : `useQuery` sans `isLoading`/`isError` ; `entries = []` par défaut (`:48`). À chaque changement de mois (swipe ou flèche), la grille s'affiche vide le temps du round-trip, puis se remplit ; hors ligne ou en erreur, elle reste vide.
- Scénario : swiper vers le mois précédent dans le métro : tous les jours paraissent non faits.
- Axe : Tone (« jamais de vocabulaire d'échec » : une grille vide se lit comme un échec) ; Constraints (`ErrorInline` existe).
- Correctif : afficher `ErrorInline` avec `retry` sur erreur ; pendant le chargement, atténuer la grille (`opacity-60`) ou garder le mois précédent affiché. Correctif sûr : oui.

### I8. Liens « Annuler » : 20 px de haut, composant existant ignoré
- `HabitudeCard.tsx:103-109` et `AddHabitudeToggle.tsx:36` : `className="mt-2 text-sm text-ink-2 underline"`. `ui.ts:67` fournit `textButton` (`min-h-11`, focus ring) « pour “Annuler” sous un formulaire ». Cible ≈ 20 px, sans anneau de focus visible (WCAG 2.5.8 non respecté, 2.4.7 à vérifier).
- Scénario : ouvrir l'ajout par erreur ; le bouton d'annulation est difficile à viser, juste sous le bouton primaire.
- Axe : Constraints (composants/classes existants) ; passe 1.
- Correctif : remplacer par `className={textButton}` aux deux endroits. Correctif sûr : oui.

## Mineur

### M1. Historique : habitude sélectionnée périmée, erreur de chargement confondue avec « vide »
- `HistoriqueView.tsx:34, 45, 54` : `habitudeId` est initialisé une fois (`habitudes[0]?.id ?? ""`). Si la vue s'ouvre avant l'arrivée des données, ou si l'habitude sélectionnée disparaît après un rafraîchissement (archivée depuis un autre appareil), `habitude` est `undefined` : le select montre une option, la grille disparaît. De plus `HabitudesView.tsx:71` passe `habitudes = []` en cas d'erreur, donc l'Historique affiche « Aucune habitude pour l'instant » (`:54`) alors que le chargement a échoué.
- Axe : Purpose. Correctif : dériver l'id effectif (`habitudes.some(h => h.id === habitudeId) ? habitudeId : habitudes[0]?.id`) et passer `isError` à la vue. Correctif sûr : oui.

### M2. Flèches de mois : `ghostButton` au lieu de `navArrowButton`
- `HistoriqueView.tsx:92-116` : boutons ← / → en `ghostButton` (≈ 32 px, extension verticale seulement). `ui.ts:58-64` définit `navArrowButton` (44 × 44) « dédié aux flèches de navigation de période ». Le swipe compense, mais pas au clavier ni à l'écran de grande taille.
- Axe : Constraints. Correctif : `navArrowButton` sur les deux boutons. Correctif sûr : oui.

### M3. Nom d'habitude tronqué et emoji doublé
- `HabitudeCard.tsx:200-203` : `nameText` = `truncate` (une ligne) avec le pill de série à droite ; « Boire 2 L d'eau avant midi » est coupé, alors que l'accueil a justement choisi deux lignes pour ce motif (`DashboardHabitItem.tsx:91`). L'emoji apparaît aussi dans l'anneau tant que l'habitude n'est pas faite (`:193`) puis devant le nom (`:201`) : doublon côte à côte.
- Axe : Constraints (`nameTextComplet` existe) et Tone (calme, sans bruit). Correctif : `nameTextComplet` (ou `line-clamp-2`), retirer l'emoji du texte. Correctif sûr : oui (le second point est un choix visuel léger).

### M4. La carte se réduit au toucher alors qu'elle n'est pas cliquable
- `HabitudeCard.tsx:176` : `listCard` porte `active:scale-[0.985]` (`ui.ts:86`) ; presser n'importe où, y compris sur le champ de valeur ou à côté de la coche, fait « respirer » toute la carte, sans action associée : fausse affordance, et un déplacement visuel pendant la saisie.
- Axe : Tone (animations discrètes, sans signal trompeur). Correctif : `active:scale-100` en surcharge sur cette carte. Correctif sûr : oui.

### M5. Squelette plus petit que le contenu
- `HabitudesSkeleton.tsx:9-10` : `h-11` pour la carte d'ajout, qui mesure ≈ 70 px (`addCard` : `p-4` + icône 38 px, `ui.ts:42, 47`). La page saute d'environ 26 px à l'arrivée des données. À vérifier visuellement la hauteur réelle du contrôle segmenté (`h-10` annoncé).
- Axe : Tone (calme, sans à-coup) ; passe 3. Correctif : `h-[70px]`. Correctif sûr : oui.

### M6. Ajout : aucun focus sur le champ « Nom » à l'ouverture
- `AddHabitudeToggle.tsx:14, 36` et `HabitudeForm.tsx:56` : le formulaire s'ouvre sans `autoFocus` ni `autoComplete="off"` ; il faut un second tap sur « Nom » pour ouvrir le clavier.
- Axe : Purpose (ajout rapide). Correctif : `autoFocus` sur le champ en création (pas en modification) et `autoComplete="off"`. Correctif sûr : oui. Hors ligne, `creerHabitude`/`modifierHabitude` passent par `useActionState` sans repli (pas de file) : comportement à confirmer avant tout correctif, donc à ne pas appliquer sans test.

### M7. Coche désactivée pendant l'aller-retour serveur
- `HabitudeCard.tsx:183` : `disabled={toggleMutation.isPending}`. Un second tap pour corriger un mauvais tap est ignoré silencieusement pendant le round-trip (plusieurs centaines de ms en mobile), et un bouton `disabled` perd le focus clavier. Le verrou évite des écritures désordonnées.
- Axe : Memorable detail (annulation). Correctif : mettre le dernier tap en file derrière la mutation en cours, ou `aria-disabled` sans perte du focus. Correctif sûr : non (change le comportement de concurrence, à valider avec `cancelQueries`).

## Options structurantes (non appliquées)

1. **Pas +/- pour les habitudes quantifiées**, y compris depuis l'accueil (aujourd'hui désactivées, `DashboardHabitItem.tsx:83`). Un tap = +1 verre, appui long = saisie libre. C'est la plus forte amélioration du geste principal pour ce type d'habitude ; implique une règle d'incrément (`unite`, `valeur_cible`).
2. **Carte d'ajout en tête de liste** (`HabitudesView.tsx:50-52`) : elle pousse les habitudes de ≈ 70 px vers le bas alors que cocher est l'usage quotidien. Options : la placer sous la liste, la replier en bouton compact, ou utiliser le FAB.
3. **« Modifier » et « Supprimer » visibles en permanence sur chaque carte** (`HabitudeCard.tsx:253-260`). Appui long / menu « ... » ou « Modifier » en tapant le titre alléger la liste et éloigneraient le bouton destructif de la zone de coche (annulation déjà couverte par `supprimerAvecAnnulation`).
4. **Corriger un jour passé depuis l'Historique** (tap sur une case) : aujourd'hui, une coche oubliée hier ne peut pas être rattrapée.
5. **Adopter `CheckToggle` coloré (ou son hitSlop) plutôt que la coche maison** pour les habitudes non quantifiées, en gardant l'anneau de progression pour les quantifiées : unifierait I1, I2 et I3 ; touche au rendu de la carte et de l'accueil.

## Déjà couvert par l'audit du 2026-11-07

- **I1 (champs sans nom accessible)** : `<select>` de l'Historique, `HistoriqueView.tsx:65` (non refait ici).
- **I2 (bascule sans état annoncé)** : `aria-pressed` sur `DashboardHabitItem.tsx:85`, déjà corrigé (non qualifié ici). `HabitudeCard.tsx:185` n'était pas visé ; voir mon I3.
- **I-2 (invalidation sans garde « en file »)** : `DashboardHabitItem.tsx:69-72` et `HabitudeCard.tsx:99, 140, 157` ; le patron correct `HabitudeCard.tsx:87-89` est en place pour la coche.
- **I-11 (saisie de valeur et suppression hors ligne sans état optimiste)** : `HabitudeCard.tsx:119-165` ; ma I4 ne traite que le geste de saisie, pas la file.
- **M-14 (`habitudesActives` jamais invalidée)** : `invalidate()` et `AddHabitudeToggle onSaved`.
- **T1** : exceptions de saisie vers `error.tsx`, déjà traitées (commentaire `HabitudeCard.tsx:127-128`).
