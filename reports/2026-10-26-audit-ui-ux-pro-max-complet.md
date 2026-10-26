# Audit UI/UX complet (ui-ux-pro-max) — 2026-10-26

Audit en lecture seule : aucun code applicatif n'est modifié. Il **complète** `reports/2026-10-14-audit-ui-ux-pro-max.md` (17 écrans, correctifs de contraste et de zones tactiles déjà appliqués) et `reports/2026-10-10-audit-perf-accessibilite.md` ; leurs constats ne sont pas répétés. Référence de jugement : `DESIGN.md` + `PRODUCT.md`.

## Périmètre et méthode

- **Inventaire** : 52 routes `page.tsx` (dynamiques testées avec l'id `1` ou la date du jour) × 3 profils (mobile 375 px clair, mobile 375 px sombre, desktop 1280 px) = 156 pages rendues dans Chromium, avec axe-core (WCAG 2.0 à 2.2 AA + bonnes pratiques), mesure des débordements horizontaux et des tailles de police, captures.
- **Code** : relecture de `BottomNav`, `Modal`, `ThemeToggle`, `ErrorState`, `lib/ui.ts`, `OngletsPharmacie`, `DayView`, `DayTimeline`, plus greps ciblés sur les 367 fichiers `.tsx`.
- **Données** : faux Supabase du rig e2e (`e2e/mock-supabase.mjs`), qui fournit barre du bas, une tâche, un journal, deux recettes ; les autres tables sont vides. Les écrans sont donc audités en **états vides et peu remplis**.
- **Piège de méthode** (à retenir pour rejouer l'audit) : en `next dev`, il faut ouvrir l'app par `http://localhost:3100`, pas `127.0.0.1`. Sinon `allowedDevOrigins` bloque les ressources de dev, l'hydratation échoue et la plupart des écrans restent en squelette. Mes deux premiers passages (squelettes) ont été écartés ; seul le passage via `localhost` fait foi.
- **Non vérifié** : contrastes et densité d'écrans réellement remplis (Pharmacie avec cours, Opinions avec propositions, Agenda chargé…), gestes (drag, swipe, pinch), clavier virtuel, texte agrandi, écrans protégés par la passkey, écran Réglages (voir « Mineurs »). Les cibles tactiles n'ont pas été remesurées : la mesure brute (`getBoundingClientRect`) ignore les extensions `after:` et donne de faux positifs ; l'audit du 14 octobre a déjà traité les cas réels.

## Verdict

L'app est mature sur les fondamentaux : **0 débordement horizontal et 0 violation de contraste axe sur 156 pages**, thème sombre cohérent, modales accessibles, `prefers-reduced-motion` global, tokens sémantiques, aucun hex en dur hors deux valeurs par défaut, 252 `aria-label`, aucun `onClick` sur `div`/`span`. Les écarts sont des **états d'erreur incomplets**, des **incohérences de patterns** entre modules plus récents et plus anciens, et l'**affichage desktop**.

## Constats priorisés

### Majeurs

**M1 — Erreurs sans bouton « Réessayer » (≈ 18 écrans).** Un simple `<p class="text-alert">Erreur de chargement … Réessaie.</p>` : `courses/CoursesList.tsx:28`, `taches/TachesView.tsx:384`, `agenda/AgendaView.tsx:441`, `habitudes/HabitudesView.tsx:56`, `notes/NotesGrid.tsx:94`, `objectifs/ObjectifsList.tsx:84`, `collection/CollectionsGrid.tsx:66`, `vinted/VintedList.tsx:110`, `opinions/OpinionsView.tsx:128`, `opinions/PartisView.tsx:54`, et les pages de détail (`CollectionDetailView:43`, `ObjectifDetailView:49`, `AnnonceView:32`, `IdeeView:31`). Le composant `ErrorState` (bouton + retour accueil) n'est utilisé que par les `error.tsx`. Règle ui-ux-pro-max « Error Recovery » : donner une étape suivante, pas un message seul. Aussi : `role="alert"` n'est posé que sur 64 des 88 usages de `errorText` (les 24 autres ne sont pas annoncés aux lecteurs d'écran).

**M2 — Message technique affiché + page entière remplacée.** `nutrition/recettes/page.tsx:21` et `nutrition/menus/MenusSemaine.tsx:48` rendent `Erreur de chargement : {error.message}` (observé à l'écran : « Invalid API key »). Sur `/nutrition/recettes` l'erreur remplace toute la page : plus de titre ni de sous-navigation Nutrition. `/nutrition/bilan` affiche une erreur sans bouton.

**M3 — Desktop étiré sur toute la largeur.** À 1280 px les cartes, onglets et listes font ~1 200 px, le FAB est collé au bord droit alors que la barre du bas reste centrée (captures `*.desk.png`). `DESIGN.md` dit « desktop non ciblé », mais l'app s'ouvre dans un navigateur et la règle « Line Length / max-w-prose » est violée. Aucun `max-w` dans `app/(app)/layout.tsx`.

### Moyens

**Y1 — Navigations hétérogènes.**
- `pharmacie/OngletsPharmacie.tsx` : onglet actif en pilule **blanche** (`bg-surface shadow-card`) alors que `Opinions`, `Habitudes`, `Nutrition`, `Tâches` utilisent l'actif **vert plein** via `SegmentedControl` (règle DESIGN : « tout choix à 2-4 options passe par lui »). Visible côte à côte sur `pharmacie.m-light.png` / `opinions.m-light.png`.
- Retours : glyphes différents (`‹ Recettes`, `‹ Opinions`, `‹ Vinted`, `← Pharmacie`, `← Retour aux tâches`, `← Plus` sur Vider ma tête), libellés de 17 à 20 px de haut (zones de tap étendues par `linkButton`, donc cible OK).
- `<nav>` de la barre du bas sans `aria-label` alors que les deux autres `<nav>` du projet en ont un.

**Y2 — Écran de partage hors layout.** `app/collection/partage/choisir/page.tsx` : pas de `<main>`, pas de `h1`, contenu hors landmarks (axe `landmark-one-main`, `region`, 3 pages). Il vit hors du groupe `(app)`.

**Y3 — États « introuvable » / détail sans titre de niveau 1.** 15 routes de détail (`/collection/1`, `/objectifs/1`, `/opinions/1`, `/pharmacie/…/1`, `/vinted/1`…) rendues avec l'id `1` n'ont aucun `h1` (axe `page-has-heading-one`). C'est attendu pour un id inexistant, mais le message « introuvable » devrait aussi porter un `h1`, comme l'a fait l'audit du 14 octobre pour l'écran d'erreur. À recontrôler avec des ids réels.

**Y4 — Zone défilante possiblement inatteignable au clavier.** `agenda/DayView.tsx:144` (`div.max-h-[55vh].overflow-auto`) et `aujourdhui/DayTimeline.tsx:119` (`max-h-[52vh]`) : pas de `tabIndex`, de rôle ni de label. axe l'a signalé (« serious ») dans un passage intermédiaire mais plus dans le passage final : c'est conditionnel au contenu qui déborde. À corriger par précaution (`tabIndex={0}`, `role="region"`, `aria-label`).

**Y5 — Voix incohérente.** Messages inline en tutoiement (« Réessaie ») contre `ErrorState` en vouvoiement (« Vous pouvez réessayer »). Trancher pour le tutoiement (usage mono-utilisateur, ton « tableau de bord doux »).

**Y6 — Plancher typographique.** 12 occurrences de `text-[10px]` (Agenda `TimeGrid`, `WeekView`, `MonthView`, `TacheBlock`, `EvenementBlock`, badges photo) contre un plancher système de 11 px ; exception Agenda documentée dans `DESIGN.md`, mais c'est la zone la moins lisible de l'app (heures 06h–11h à 10 px en `ink-2`). À tester avec le texte agrandi du téléphone.

### Mineurs

- **Emoji / glyphes en guise d'icônes** : `DashboardHabitItem.tsx:87,91`, `HabitudeCard.tsx:197,230`, `BarreSuiviLecture.tsx:91` (★/☆), `PhotosEditor.tsx:163` (✕), `pathologie/page.tsx:23,25` (✓/✕), `ExerciceBloc.tsx:262` (✓), toasts 🎉/💪. Rendu dépendant de la police et lus tels quels par les lecteurs d'écran (🔥 non masqué). Remplacer par SVG + `aria-hidden`. (Le champ d'icône d'une habitude, `HabitudeForm.tsx:146`, est un choix utilisateur légitime.)
- **Couleur par défaut `#4f7cff`** (`taches/listes/AddListeForm.tsx:68`, `AddTagForm.tsx:56`) : seconde teinte bleue hors palette OKLCH.
- **Boutons « Suppr. » abrégés** visibles en permanence sur chaque ligne (Journal, Objectifs) : libellé abrégé et rouge répété. Choix assumé par un rapport antérieur (`2026-09-04-…-libelle-supprimer`) : à réévaluer seulement si la densité gêne.
- **Découvrabilité** : accès aux réglages Vinted par un simple lien vert en pied de liste.
- **Réglages fragile à un champ manquant** : `reglages/AlertesNutritionRow.tsx:38` fait `reglages.rappel_saisie_heure.slice(0, 5)` ; si la colonne est absente ou nulle, **tout Réglages** tombe sur l'écran d'erreur. Observé uniquement avec le faux Supabase (champ non simulé) ; la base réelle l'a vraisemblablement, donc priorité faible, mais un repli défensif coûte une ligne. Conséquence : l'écran Réglages n'a pas pu être audité visuellement (déjà signalé le 14 octobre).

### À vérifier en dehors de ce banc

- Avertissement d'hydratation (« attributes of the server rendered HTML didn't match ») sur `/plus` en dev, plausiblement les ids d'accessibilité de dnd-kit.
- Erreur dev `/vider-ma-tete/[jour]` : « unstable value `new Date()` while prerendering » (Cache Components). Vérifier qu'elle n'apparaît pas au `next build`.

### À préserver
0 débordement horizontal ; 0 contraste fautif détecté ; barre du bas flottante avec safe-area ; `aria-current` partout ; mode sombre cohérent (captures `*.m-dark`) ; écran Vider ma tête (nouveau module) et Pharmacie/Huiles cohérents avec le système de cartes.

## Plan de refonte par lots

| Lot | Contenu | Effort | Risque |
|---|---|---|---|
| **1. États d'erreur** (M1, M2, Y5) | `ErrorInline` partagé (message générique + « Réessayer » branché sur `refetch` + `role="alert"` systématique), détail technique en console seulement, titre et sous-nav conservés sur `/nutrition/recettes` | M | Faible |
| **2. Accessibilité rapide** (Y2, Y3, Y4, label `<nav>`) | `<main>` + `h1` sur l'écran de partage ; `h1` dans les états « introuvable » ; `tabIndex`/`aria-label` des zones défilantes de l'Agenda | S | Très faible |
| **3. Largeur desktop** (M3) | Conteneur `mx-auto max-w-[640px]` dans `(app)/layout`, FAB et barre du bas alignés dessus ; vérifier grille horaire et pinch-zoom de l'Agenda | S | Faible |
| **4. Cohérence navigation** (Y1) | `OngletsPharmacie` → `SegmentedControl` (variante lien existante `segmentClasse`) ; composant `BackLink` unique (glyphe, hauteur, libellé) | M | Moyen (transitions de page) |
| **5. Polish** (Y6, mineurs) | Emoji → SVG, couleur par défaut tokenisée, repli défensif de `AlertesNutritionRow`, 10 px → 11 px si la grille le supporte | M | Faible |
| **6. Re-test avec données réelles** | Rejouer le script contre une base remplie : contrastes en contexte, `h1` des détails, Agenda dense, texte agrandi, geste par geste | S | — |

Ordre conseillé : 2 → 1 → 3 → 4 → 5, puis 6. Les lots 1 à 3 apportent l'essentiel de la valeur perçue pour un risque faible.

## Annexe — reproduction

Faux Supabase : `node e2e/mock-supabase.mjs` ; serveur : `E2E_SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=e2e-dummy EXPOSE_TESTING_API=1 E2E_VERROU_DESACTIVE=1 next dev -p 3100` ; ouvrir **`localhost`** (pas `127.0.0.1`). Le script d'audit (Playwright + `node_modules/axe-core/axe.min.js`, injection par page, mesures DOM) n'est pas versionné ; les 156 captures restent en local.
