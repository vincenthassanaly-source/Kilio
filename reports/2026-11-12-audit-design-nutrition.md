# Audit design du module Nutrition — 2026-11-12

Lecture seule, trois passes de la grille (conformité/accessibilité, parcours, finitions). Périmètre : `src/app/(app)/nutrition/**` (hub, Journal, Bilan, Recettes, Menus), `NutritionSubNav`, `Modal`, `CheckToggle`, `SegmentedControl`, `lib/ui.ts`, `QuickAddFab` (réutilise le panneau d'ajout). Aucune mesure en navigateur : contrastes calculés à partir des tokens (conversion oklch), tailles de cibles estimées.

## Résumé

- Base saine : tokens, `SegmentedControl`, toasts avec « Annuler » sur les suppressions, ton graduel ambre/rouge déjà en place ; aucun constat critique.
- Le geste le plus fréquent (ajouter un repas) est rapide mais sans annulation, sans file hors ligne, et hérite d'un hub qui ajoute un écran devant le Carnet.
- Écarts de ton et de contraste concentrés sur l'ambre (4,09:1) et sur la coloration des protéines en dépassement, contraire à PRODUCT.md.

Total : 0 critique, 6 importants, 18 mineurs, 6 options structurantes.

## Critique

Aucun.

## Important

### I-1. Ajout d'un repas : aucune annulation, alors que suppression et « mangé » en ont une
- Fichiers : `journal/AjoutRepasBouton.tsx:23-30` (`showToast` sans action), `menus/AjoutMenuBouton.tsx:68`, `recettes/[id]/RecetteMacros.tsx:85` (action « Voir » seulement). Contre-exemples : `journal/JournalRepas.tsx:37-48` et `menus/LigneMenu.tsx:49-56` proposent « Annuler ».
- Scénario : tap sur une suggestion de « Récents », valeur pré-remplie 200 g au lieu de 100 g, validation d'un tap ; le toast confirme mais ne permet pas de revenir en arrière. Il faut retrouver la ligne dans la liste et la supprimer à la main.
- Axe violé : Memorable detail (retour visuel, annulation du geste le plus fréquent).
- Correctif : faire renvoyer l'`id` de la ligne créée par `addJournalEntry` (`actions/journal.ts:171-177`) et ajouter une action « Annuler » au toast qui appelle `removeJournalEntry`. Même motif que `LigneMenu`.
- Correctif sûr : non (contrat de l'action serveur).

### I-2. Le geste d'ajout, la coche « mangé » et la pesée ne fonctionnent pas hors ligne
- Fichiers : `journal/AjoutRepasPanneau.tsx:123-127` (catalogue en mémoire TanStack, `staleTime` 5 min, pas de copie Dexie), `:257-269` (échec = `MESSAGE_HORS_LIGNE`), `menus/LigneMenu.tsx:44`, `bilan/PeseeForm.tsx:62`. La file `pending_actions` couvre `taches`, `notes`, `courses`, `habitudes`, `pharmacie` (cartographie de l'audit du 07-11) mais pas la nutrition.
- Scénario : cuisine ou sous-sol sans réseau, ouverture du panneau à froid : « Le catalogue n'a pas pu être chargé » ; si le catalogue était chargé, la validation échoue avec un message, la saisie reste en place mais rien n'est enregistré. Les courses et les habitudes, elles, se mettent en file.
- Axe violé : Memorable detail (comportement hors ligne) et Constraints (Dexie et file hors ligne à utiliser).
- Correctif : catalogue en snapshot Dexie (`cache_lecture`) et `addJournalEntry` / `validerMenuEntry` en file. À traiter avec l'option O-3.
- Correctif sûr : non.

### I-3. Les protéines sont signalées en dépassement dans le Journal, mais pas dans les Menus ni le Bilan
- Fichiers : `journal/ResumeJour.tsx:34-37` et `:125` (`MacroBar` applique `severiteDepassement` aux protéines : triangle, ambre puis rouge gras). Règle inverse dans `menus/ComparaisonObjectif.tsx:20-22` (« les protéines sont un plancher, jamais colorées en dépassement »), `lib/nutrition/bilan.ts:15` (protéines ≥ cible = réussi) et PRODUCT.md (Menus : « protéines jamais en alerte »).
- Scénario : objectif 120 g, 140 g mangés, c'est le résultat voulu en perte de poids ; le Journal affiche un triangle d'alerte et « 140 / 120 g » en rouge gras. Le Bilan du même jour compte la journée comme réussie.
- Axe violé : Tone (jamais de jugement ni de vocabulaire d'échec) ; incohérence interne qui casse la mémoire musculaire (Audience).
- Correctif : forcer `sev = "ok"` pour les protéines dans `MacroBar`, et le noter dans DESIGN.md (qui dit « kcal ou macro » à la section Tertiary).
- Correctif sûr : non (règle produit à trancher, DESIGN.md à aligner).

### I-4. Le texte ambre (`text-warning`) n'atteint pas 4,5:1
- Fichiers : `globals.css:39` (`--accent-warning: oklch(0.6 0.15 55)`), usages texte : `journal/ResumeJour.tsx:37,95`, `menus/ComparaisonObjectif.tsx:12`, `bilan/BilanVues.tsx:55,219,242`.
- Calcul : 4,09:1 sur `surface`, 3,43:1 sur `surface-alt` ; plus bas encore sur le fond `bg-warning/15` des cercles du Bilan. Texte de 12 à 13 px en semibold, donc non « grand texte ». DESIGN.md documente le lot 6 (4,5:1 sur `surface-alt`) pour `ink-3`, `alert` et les macros, pas pour l'ambre. Les autres tokens recalculés passent (alert 6,0 ; protéines 5,5 ; glucides 5,5).
- Axe violé : Constraints (contraste cible du système, WCAG 1.4.3). Le marqueur non chromatique (triangle) limite l'impact.
- Correctif : assombrir `--accent-warning` en clair (L ≈ 0,53 à 0,55) et vérifier le fond teinté ; documenter dans DESIGN.md. Aucun autre module n'utilise `text-warning` hors Tâches (`TachesView.tsx:372`) et Pharmacie (`BadgesHuile.tsx:63,75`) : relire ces trois usages.
- Correctif sûr : oui (token de couleur uniquement), avec vérification visuelle.

### I-5. Journal : aucun retour rapide à aujourd'hui, et la feuille d'ajout ne dit pas pour quel jour
- Fichiers : `journal/JournalNavigationJour.tsx:23-42` et `journal/page.tsx:19-29` (seulement ‹ ›), `journal/AjoutRepasBouton.tsx:74` (titre fixe « Ajouter un repas », la date part en champ caché `AjoutRepasPanneau.tsx:298`). Contre-exemple : `menus/MenusSemaine.tsx:124-128` offre « Cette semaine ».
- Scénario : swipe de 3 jours en arrière pour consulter, puis retour vers aujourd'hui = 3 taps ou swipes. Si la saisie d'un repas se fait à ce moment-là, la feuille ne rappelle pas la date : le repas va sur le jour consulté, le toast ne le dit pas.
- Axe violé : Purpose (consulter ou saisir en quelques secondes) et Memorable detail (le geste ne doit pas se tromper de cible).
- Correctif : lien « Aujourd'hui » (style `linkButton`) affiché quand `jour.date` n'est pas aujourd'hui, et, hors aujourd'hui, jour dans le titre de la feuille et dans le toast.
- Correctif sûr : oui (ajout d'affichage, aucun changement de comportement ni de schéma).

### I-6. Journal : nom du repas tronqué sur la liste principale
- Fichiers : `journal/JournalEntriesList.tsx:39` (`truncate`), contrainte de largeur due à `:43-59` (kcal + bouton texte « Suppr. »). Même motif dans le choix d'un aliment : `journal/AjoutRepasPanneau.tsx:95-96`.
- Scénario : à 360-390 px, il reste environ 170 px pour le nom : « Escalope de poulet grillée » ou deux yaourts qui ne diffèrent qu'à la fin deviennent illisibles, sans moyen de les lire en entier. `nameTextComplet` (`lib/ui.ts:97`) existe pour ce cas.
- Axe violé : Purpose (lecture en quelques secondes) ; Constraints (composant/classe existants).
- Correctif : `nameTextComplet` à la place de `truncate` sur le nom (et sur `LigneCatalogue`), `min-w-0` déjà en place. Estimation de largeur à confirmer sur appareil.
- Correctif sûr : oui.

## Mineur

### M-1. Ordre des moments incohérent
- `journal/JournalEntriesList.tsx:16` et `lib/nutrition/compute.ts:98` (`MOMENTS_REPAS`, utilisé par les sélecteurs) : petit-déj, déjeuner, dîner, collation. `lib/menus/compute.ts:11` (`CRENEAUX_MENU`) et PRODUCT.md : petit-déj, déjeuner, collation, dîner.
- Scénario : une collation de 16 h s'affiche après le dîner dans le Journal et avant dans les Menus.
- Axe : Audience (mémoire musculaire). Correctif : un seul ordre (celui des Menus). Sûr : oui (affichage), choisir l'ordre canonique.

### M-2. « kcal restantes aujourd'hui » sur n'importe quel jour
- `journal/ResumeJour.tsx:90-93` : libellé fixe, y compris pour hier. Axe : Purpose (information fausse). Correctif : passer `estAujourdhui` et dire « kcal restantes » / « sur la journée ». Sûr : oui.

### M-3. Résumé du jour absent quand la cible du type de jour manque
- `journal/JournalJour.tsx:57-62` et `journal/ResumeJour.tsx:76-82` : avec seulement l'objectif « repos » défini, un jour d'entraînement n'affiche ni anneau ni macros, juste « Définis un objectif ci-dessus » alors que le formulaire est replié. Axe : Purpose. Correctif : message nommant le type manquant (« Définis l'objectif d'entraînement ») ou repli sur la cible de repos. Sûr : non pour le repli, oui pour le message.

### M-4. Enregistrement des objectifs sans retour visible
- `journal/ObjectifForm.tsx:111-116` (seule l'invalidation de cache), `:127-155` (le formulaire reste ouvert, aucun toast). `:52,68,84` : `defaultValue ?? 0` oblige à effacer le « 0 ».
- Axe : Constraints (toasts du système) et Purpose. Correctif : `showToast("Objectifs enregistrés")` et fermeture, `""` à la place de `0`. Sûr : oui.

### M-5. Filtres de recettes : état non exposé, classes en conflit
- `recettes/RecettesList.tsx:81-106` : boutons-bascule sans `aria-pressed` (état actif = couleur et graisse), deux groupes (temps, kcal) sans libellé de groupe. L'état actif ajoute `bg-kcal-soft text-kcal` à `pillTag` qui porte déjà `bg-surface-alt text-ink-2` : le résultat dépend de l'ordre CSS généré, à confirmer au rendu.
- Axe : Constraints (`aria-pressed` comme `SegmentedControl`). Correctif : `aria-pressed`, `role="group"` avec `aria-label`, classes conditionnelles exclusives. Sûr : oui.

### M-6. Boutons « Annuler » nus, sans zone de tap de 44 px
- `recettes/AddRecetteToggle.tsx:33`, `recettes/[id]/RecetteHeader.tsx:32` : `text-sm text-ink-2 underline`, environ 20 px de haut. `textButton` (`lib/ui.ts:68`) existe. Axe : Constraints (cible 44 px, composant existant). Sûr : oui.

### M-7. Titre de la fiche recette tronqué
- `recettes/[id]/RecetteHeader.tsx:46` : `truncate` sur le `h1`. Axe : Purpose. Correctif : `text-balance break-words`. Sûr : oui.

### M-8. « Suppr. » : nom accessible non contextualisé
- `journal/JournalEntriesList.tsx:46-59`, `recettes/[id]/RecetteHeader.tsx:81`, `IngredientManager.tsx:120`, `IngredientsLibresManager.tsx:119`, `EtapesManager.tsx:128` : N boutons annoncés « Suppr. » (abréviation, aucun nom d'élément). `PeseeForm.tsx:155` fait bien `aria-label="Supprimer le relevé du …"`.
- Axe : Constraints (noms accessibles, grille passe 1). Correctif : `aria-label={\`Supprimer « ${nom} »\`}`. Sûr : oui.

### M-9. Coche « mangé » : le libellé change en même temps que `aria-pressed`
- `menus/LigneMenu.tsx:80` combiné à `components/CheckToggle.tsx:47-49` : « Annuler « X » mangé » avec `aria-pressed=true` se lit comme une double inversion. Axe : Constraints. Correctif : libellé constant (« « X » mangé »). Sûr : oui.

### M-10. Retirer un repas déjà mangé du menu laisse le Carnet inchangé, sans le dire
- `menus/LigneMenu.tsx:65` (message « Retirer « X » du menu ? ») et `actions/menus.ts:41-50` (l'entrée du Journal reste). Scénario : coche par erreur, puis retrait de la ligne pour « défaire » : les kcal restent comptées et la ligne a disparu, impossible de décocher. Axe : Purpose (parcours cohérent). Correctif : si `repas.mange`, message « …reste dans le Carnet alimentaire ». Sûr : oui.

### M-11. Finitions du bouton flottant et de la bascule d'entraînement
- `journal/AjoutRepasBouton.tsx:52` : `shadow-card` sur un bouton flottant (DESIGN.md réserve `shadow-float` aux boutons d'action rapide ; `QuickAddFab.tsx:176` l'utilise), et `transition` générique (`:52,:66`, aussi `lib/ui.ts:39,41,57,64,66`) au lieu de `transition-transform` explicite.
- `menus/BasculeEntrainementJour.tsx:59` : `focus-visible:outline-2 outline-kcal` au lieu de l'anneau `ring-2 ring-offset-2` des autres contrôles.
- Axe : Constraints (tokens). Sûr : oui (`ui.ts` est un fragment partagé : à corriger là, hors module).

### M-12. Cases du calendrier du Bilan sous 44 px
- `bilan/BilanVues.tsx:157-181` : `aspect-square` en 7 colonnes, `gap-1.5`, `max-w-sm`. Largeur utile estimée de 294 à 324 px sur 360-390 px d'écran : cellules de 37 à 41 px (checklist « finitions » : hit area ≥ 40, idéalement 44). Axe : Audience (usage une main). Correctif : réduire le gap ou enlever le padding de la carte du calendrier, ou étendre la zone de tap. Sûr : oui. À mesurer.

### M-13. Lexique de succès et d'échec dans le Bilan et les jauges
- `bilan/BilanVues.tsx:34-36` (« kcal dépassées »), `:188` (« Hors objectif », qui regroupe ambre et rouge), `:288` (« Pas de série en cours. »), `journal/ResumeJour.tsx:93` et `menus/ComparaisonObjectif.tsx:60` (« dépassé de X kcal »). Le Journal a déjà « X kcal au-dessus de l'objectif » pour le cas léger.
- Axe : Tone (aucun vocabulaire d'échec ; une série à zéro se lit comme une rupture). Correctif : « au-dessus de l'objectif » dans tous les cas, légende « Hors de la cible », masquer la ligne de série quand elle vaut 0. Sûr : oui (texte).

### M-14. Anneau et barres sans transition
- `journal/ResumeJour.tsx:103-114` : le cercle n'a pas de `transition` sur `stroke-dashoffset` alors que DESIGN.md décrit un anneau animé ; `:63` la barre a `transition-[width]` sans durée ni easing du système (`--ease-out`). À l'ajout d'un repas la jauge saute au lieu de glisser. Axe : Memorable detail (retour visuel). Correctif : `transition-[stroke-dashoffset] duration-300 ease-[var(--ease-out)]`, la règle globale de mouvement réduit s'applique. Sûr : oui.

### M-15. Deux boutons « Ajouter un repas » simultanés, SVG décoratifs non masqués
- `journal/JournalRepas.tsx:77` (variante carte) et `journal/JournalJour.tsx:88` (bouton flottant) coexistent à l'état vide, avec le même nom accessible. `journal/JournalRepas.tsx:71`, `nutrition/page.tsx:10-45` : SVG sans `aria-hidden`. Axe : Purpose (densité). Correctif : ne rendre que la carte à l'état vide, ou laisser le flottant seul. Sûr : oui pour `aria-hidden`, non pour le doublon (choix de design).

### M-16. Message vers un onglet « Aliments » qui n'existe pas
- `recettes/[id]/IngredientManager.tsx:154` : aucun onglet ni écran de création d'aliments (sous-navigation : Journal, Bilan, Recettes, Menus). Chemin mort s'il se déclenche. Axe : Purpose. Correctif : reformuler (« Aucun aliment en base. ») ou ouvrir une création. Sûr : oui pour le texte.

### M-17. Choix d'un ingrédient dans un `<select>` natif de toute la table
- `recettes/[id]/IngredientManager.tsx:168-184` : liste complète sans recherche, alors que le Journal a un sélecteur avec recherche. Charge utile : voir perf M1 de l'audit du 07-11 (`recettes/[id]/page.tsx:29`). Axe : Audience (expert, gestes rapides). Correctif : réutiliser la recherche du catalogue. Sûr : non.

### M-18. Chiffres qui changent sans `tabular-nums`, boutons +/− sans unité
- `recettes/[id]/RecetteMacros.tsx:133` : les macros varient avec le compteur de portions, sans `tabular-nums` (le compteur `:116` l'a). `journal/JournalEntriesList.tsx:43` : kcal de lignes empilées non alignés. `journal/AjoutRepasPanneau.tsx:338,357` : « Retirer 50 » / « Ajouter 50 » sans unité (g, ml, pièce, portion).
- Axe : Constraints (finitions) / Audience. Sûr : oui.

## Options structurantes (non appliquées)

- **O-1. Hub `/nutrition` en trop sur le chemin quotidien.** La barre du bas pointe sur `/nutrition` (`lib/navigation/registry.ts:24,185`), qui affiche 4 cartes (`nutrition/page.tsx`) alors que la sous-navigation `NutritionSubNav` répète les mêmes destinations. Chaque consultation du Carnet coûte un écran et un tap. Piste : faire de `/nutrition` le Journal (ou y rediriger) et garder les autres destinations dans la sous-navigation. Axes : Purpose, Audience.
- **O-2. Re-saisie en un tap depuis « Récents ».** Aujourd'hui : FAB, tap sur le récent, écran de quantité, validation (trois taps minimum, `AjoutRepasPanneau.tsx:203-210`). Piste : bouton « + » direct sur la ligne qui rejoue la dernière quantité, avec toast annulable (voir I-1). Axe : Memorable detail.
- **O-3. Nutrition dans la file hors ligne.** Snapshot Dexie du catalogue (`cache_lecture`), actions `addJournalEntry`, `validerMenuEntry`, `enregistrerMesure` en file avec la garde `enfile` du reste de l'app (cf. I-2 et I-2 de l'audit du 07-11 pour l'invalidation). Axes : Memorable detail, Constraints.
- **O-4. Fiche recette : mode lecture et mode édition.** En cuisine, la fiche montre « Éditer » et « Suppr. » sur chaque ingrédient et chaque étape, deux formulaires d'ajout ouverts, et les étapes sont sous les ingrédients et leur formulaire. Piste : lecture épurée (ingrédients puis étapes, grande taille), bouton « Modifier » qui révèle les contrôles. Axes : Purpose, Audience.
- **O-5. Haut du Journal : objectifs et type de jour.** « Objectif (repos) » + lien « Modifier les objectifs » occupent la première place devant le résumé (`JournalJour.tsx:75-78`), pour une action occasionnelle ; le type de jour s'affiche mais ne se change que depuis Aujourd'hui ou Menus. Piste : résumé d'abord, objectifs derrière un bouton d'en-tête, `BasculeEntrainementJour` réutilisé près de l'anneau. Axes : Purpose, Memorable detail.
- **O-6. Cohérence des gestes.** (a) Suppression : annulation par toast dans le Journal, dialogue `confirmDelete` pour Menus, Pesée, Recettes. (b) Le Journal se balaie au doigt jour par jour (`JournalSwipeWrapper`), les Menus non (semaine par flèches). (c) Densité des Menus : 4 créneaux × 7 jours, dont les créneaux vides prennent 44 px chacun (`JourMenu.tsx:78`). Piste : harmoniser sur l'annulation différée, le swipe de semaine, et replier les créneaux vides. Axes : Audience, Tone.

## Déjà couvert par l'audit du 2026-11-07 (cité, non refait)

- **I1 (champs sans nom accessible)** : `RecettesList.tsx:72` reste ouvert (champ de recherche sans libellé). `IngredientManager.tsx:54,194` et `EtapesManager.tsx:39,47,55,158,160` portent désormais un `aria-label` (corrigé depuis). Restent sans nom : `EtapesManager.tsx:156` (titre à l'ajout), `IngredientsLibresManager.tsx:43,49` (édition) et `:147-148` (ajout).
- **I3 (fond de `Modal` qui ferme)** : touche la feuille d'ajout de repas (`AjoutRepasBouton.tsx:74`, `AjoutMenuBouton.tsx:60`) : un tap hors de la feuille à l'étape de quantité perd l'aliment choisi et la valeur saisie.
- **I-12 (FAB et séance flottante au même emplacement)** : `AjoutRepasBouton.tsx:53` pose son bouton à `bottom: safe-area + 90px`, au même endroit que le « + » du dashboard et que la barre de séance.
- **M-13 (modales sans historique)** : le Journal et les Menus sont déjà conformes (`useBackClose` dans `AjoutRepasBouton.tsx:40` et `AjoutMenuBouton.tsx:40`).
- **Perf M1 (`select("*")`)** : `JournalJour.tsx:36`, `BilanContenu.tsx:45`, `MenusSemaine.tsx:44` (objectifs), `recettes/[id]/page.tsx:29` (aliments).
- **Parcours vérifiés sans défaut** : `JournalEntriesList` invalide `catalogueJournal` et `resume-nutrition` (`JournalRepas.tsx:49-56`), `useAjoutRepasTermine`, `EnvoyerCoursesBouton`.
- **Fit-and-finish** : conclusion générale « rien à corriger de façon générique » confirmée sauf les points M-11, M-14, M-18. Sans objet dans ce module : contours d'images (aucune image), ombres hors tokens. Rayons concentriques corrects (`SEGMENT_CADRE` 16 − 4 = 12).

## Hors constats

Le calcul de contraste a été fait avec une conversion oklch vers sRGB et la formule WCAG ; les ratios sont des estimations (écart possible de ±0,1). Le thème sombre n'a pas été recalculé (l'ambre sombre `oklch(0.75 0.14 55)` est nettement plus clair).
