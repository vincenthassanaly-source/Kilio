# Audit design du module Objectifs (2026-11-12)

Lecture seule. Périmètre : `src/app/(app)/objectifs/**`, `src/lib/objectifs/valeur.ts`, composants partagés utilisés (`CheckToggle`, `SegmentedControl`, `ErrorInline`, `lib/ui.ts`). `ProgressRing` n'est pas utilisé par ce module (barres maison). Grille : trois passes (conformité/a11y, parcours, finitions) contre les 5 axes du brief. Les Web Interface Guidelines n'ont pas été re-téléchargées (pas d'accès réseau dédié) : les règles courantes (noms accessibles, cibles, focus, `aria-*`) ont été appliquées de mémoire.

## Résumé

- Le module est globalement sain : états de chargement/erreur présents, optimisme avec rollback sur les coches, `confirmDelete` partout, clés de cache croisées déjà corrigées (CLICK-PATH-501). Aucun constat Critique.
- Le geste le plus fréquent (cocher une étape, saisir une mesure) a des défauts réels : coches désactivées pendant une requête, noms accessibles identiques, saisie de mesure sans Entrée, zones de tap qui se chevauchent, aucun comportement hors ligne.
- Le reste relève de finitions (skeleton, `tabular-nums`, `truncate` sur le titre, contraste de la ligne cible) et de cinq options structurantes (progression absente de la liste, doublons d'actions).

## Critique

Aucun.

## Important

**I1. Toutes les coches d'étape se désactivent pendant une requête** (Memorable detail)
- `objectifs/[id]/ObjectifSuiviEtapes.tsx:126` : `disabled={toggleMutation.isPending}` sur chaque `CheckToggle`.
- Scénario : cocher trois étapes d'affilée. Pendant l'aller-retour serveur, les taps suivants sont ignorés, sans aucun signe visuel (`CheckToggle` n'a pas d'état désactivé visible).
- Correctif : désactiver seulement l'étape en cours, `disabled={toggleMutation.isPending && toggleMutation.variables?.id === etape.id}`. L'optimisme et le rollback existent déjà. Correctif sûr : oui.

**I2. Coches d'étape sans nom propre et libellé qui s'inverse** (Purpose, Constraints)
- `ObjectifSuiviEtapes.tsx:124-133`.
- Scénario : lecteur d'écran. Chaque coche annonce « Marquer fait » ou « Marquer non fait », sans le titre de l'étape ; avec `aria-pressed`, l'annonce devient contradictoire (« Marquer non fait, activé »). `CheckToggle` prévoit `describedBy`, utilisé dans `taches/TasksList.tsx:654`, absent ici.
- Correctif : `id={\`etape-titre-${etape.id}\`}` sur le `<span>` du titre et `describedBy` sur la coche ; libellé constant « Fait » (l'état passe par `aria-pressed`). Correctif sûr : oui.

**I3. Saisie d'une mesure : pas de formulaire, Entrée ne fait rien, action principale en bouton discret** (Memorable detail)
- `ObjectifSuiviValeur.tsx:381-420`.
- Scénario : pesée quotidienne au téléphone. On tape la valeur, la touche « OK » du clavier ne valide pas (aucun `<form>`), le bouton « Enregistrer » est un `ghostButton` (aspect secondaire). Aucun retour de succès hors du rafraîchissement de la barre et de la courbe.
- Correctif : envelopper la ligne dans un `<form onSubmit>` (`preventDefault` puis `enregistrer()`), bouton `type="submit"`, et lui donner le style primaire. Correctif sûr : oui (même appel, nouveau déclencheur).

**I4. Zones de tap des actions d'étape : chevauchement vertical et faible largeur** (Constraints, Memorable detail)
- `ObjectifSuiviEtapes.tsx:121,137-162` ; `lib/ui.ts:52-66` (`zoneTap44`, débordement de 6 px haut et bas).
- Scénario : `<ul className="gap-2">` (8 px) alors que chaque bouton déborde de 6 px : les zones de deux lignes voisines se chevauchent de 4 px. Un tap sur « Suppr. » peut tomber sur « ↑ » de la ligne suivante (le commentaire de `lib/ui.ts` exige ≥ 12 px d'écart). Les boutons « ↑/↓ » font environ 26 px de large.
- Correctif : `gap-3` sur la liste et `min-w-9` sur les flèches. Correctif sûr : oui.

**I5. Lien « Annuler » des formulaires d'édition : cible ≈ 20 px et pas d'anneau de focus** (Constraints)
- `objectifs/ObjectifCard.tsx:82-87` et `objectifs/[id]/ObjectifHeader.tsx:59` : `className="mt-2 text-sm text-ink-2 underline"`. `AddObjectifToggle.tsx:36` utilise bien `textButton` (44 px, `focusRing`).
- Correctif : remplacer par `className={textButton}`. Correctif sûr : oui.

**I6. Cases à cocher natives pour le rattachement des habitudes** (Constraints, accessibilité)
- `objectifs/ObjectifForm.tsx:200-206`.
- Scénario : `<input type="checkbox">` brut de 13 à 16 px, rangées de ≈ 22 px de haut séparées de 8 px (cible < 24 px, WCAG 2.5.8), sans anneau de focus du système. Le brief impose `CheckToggle` ou `Switch`.
- Correctif : `min-h-11` sur le `<label>` et `accent-kcal` + `h-5 w-5` sur la case (ou `CheckToggle` dans un bouton). Le champ non contrôlé avec `name="habitude_ids"` doit rester. Correctif sûr : oui pour `min-h-11` et la taille ; non pour un remplacement par `CheckToggle`.

**I7. Changement de statut sans retour immédiat dans l'en-tête** (Memorable detail)
- `ObjectifHeader.tsx:114-131`.
- Scénario : type « Fait / pas fait » ; deux chemins mènent au même état : le bouton de la carte (optimiste, `ObjectifSuiviBinaire.tsx:19-44`) et le contrôle segmenté de l'en-tête (non optimiste). Le segment actif ne bouge qu'après l'aller-retour et le refetch, et les taps pendant `isPending` sont ignorés sans signe.
- Correctif : même mécanisme `setQueryData` + rollback que `ObjectifSuiviBinaire`. Correctif sûr : non (logique de mutation).

**I8. Page détail muette pour un objectif Nutrition sans données** (Audience)
- `ObjectifDetailView.tsx:72` : `objectif.type_suivi === "nutrition" && suiviNutrition && …`. Si `suiviNutrition` est `null` (`actions/objectifs.ts:335` le fixe par défaut), la page ne montre que l'en-tête, sans explication ni action.
- Correctif : rendre un `ErrorInline` « Suivi indisponible » avec `retry` quand `suiviNutrition` est nul. Correctif sûr : oui.

**I9. Coches et saisies sans file hors ligne** (Constraints, Audience)
- `ObjectifSuiviEtapes.tsx:48-68`, `ObjectifSuiviBinaire.tsx:19-44`, `ObjectifSuiviValeur.tsx:327-357` : appels directs aux Server Actions.
- Scénario : usage hors ligne (métro). La coche s'inverse puis revient avec le toast « Impossible de mettre à jour l'étape » ; la mesure du jour affiche une erreur. Les habitudes passent par la file hors ligne, pas les objectifs. À distinguer du scénario A de l'audit du 2026-11-07 (habitudes quantifiées), qui ne concerne pas ce module.
- Correctif : passer la coche d'étape (et éventuellement la saisie de mesure) par la file Dexie existante, comme `HabitudeCard`. Correctif sûr : non.

**I10. Boutons « Modifier » et « Suppr. » identiques sur chaque carte** (Constraints, accessibilité)
- `ObjectifCard.tsx:117-130` et `ObjectifSuiviEtapes.tsx:155-162`.
- Scénario : navigation au lecteur d'écran dans une liste de N objectifs ou d'étapes : N boutons « Suppr. » sans contexte. « Suppr. » est aussi une abréviation peu soignée.
- Correctif : texte visible « Supprimer » et `aria-label` du type « Supprimer l'objectif {titre} » (commence par le texte visible), idem « Modifier {titre} » et « Supprimer l'étape {titre} ». Correctif sûr : oui.

## Mineur

**M1. Skeleton d'ajout trop bas** (finitions) : `objectifs/loading.tsx:9` : `h-11 rounded-2xl` (44 px, 16 px) alors que la carte d'ajout réelle fait ≈ 70 px avec `rounded-card`. Saut de mise en page à l'hydratation. Correctif : `h-[70px] rounded-card`. Sûr : oui.

**M2. Compteur d'étapes sans `tabular-nums`** : `ObjectifSuiviEtapes.tsx:113` (`{faites}/{etapes.length}` change à chaque coche). Correctif : ajouter `tabular-nums` (ou utiliser `metaText`). Sûr : oui.

**M3. Titre de la page détail tronqué** (Audience, finitions) : `ObjectifHeader.tsx:73` : `truncate` sur le `<h1>`. Un titre long n'est jamais lisible en entier. Correctif : `text-balance break-words` à la place. Sûr : oui.

**M4. Erreur de suppression non annoncée et message brut** (Tone) : `ObjectifHeader.tsx:99-101,134` : `<p className={errorText}>` sans `role="alert"`, et `e.message` (message Supabase brut) affiché. Correctif : `role="alert"` et message fixe comme dans `runAction` (toast). Sûr : oui.

**M5. Glyphe « + » lu par les lecteurs d'écran** : `AddObjectifToggle.tsx:15-19`. Correctif : `aria-hidden="true"` sur la pastille. Sûr : oui.

**M6. Barres de progression incohérentes et sans rôle** (Constraints) : `ObjectifSuiviValeur.tsx:365-370` (piste `surface-alt`, remplissage `bg-kcal`, sans `role="progressbar"`) contre `ObjectifSuiviHabitudes.tsx:35-40` (piste `bg-line`, remplissage `--accent-objectifs`, avec rôle). Correctif : même piste `surface-alt` et même remplissage, `role="progressbar"` + `aria-valuenow` sur la barre de valeur. Sûr : oui.

**M7. Ligne cible du graphique peu visible et non légendée** (accessibilité) : `ObjectifSuiviValeur.tsx:243-252` : trait `var(--line)` (≈ 1,3:1) en pointillés, absent de la légende (`:276-286`). Correctif : `var(--control-border)` et entrée « Cible » dans la légende. Sûr : oui.

**M8. Retour système ne ferme pas l'édition** (Audience, PWA) : `ObjectifCard.tsx:65` et `ObjectifHeader.tsx:49` n'appellent pas `useBackClose` (utilisé par `AddObjectifToggle.tsx:11`). Correctif : réutiliser le hook. Sûr : oui.

**M9. Ajout d'étape vide ignoré sans message** : `ObjectifSuiviEtapes.tsx:72`. Correctif : `disabled` tant que `titre.trim()` est vide. Sûr : oui.

**M10. Case cochée perdue si les liens arrivent après** : `ObjectifForm.tsx:200` : la `key` change quand `idsLies` arrive et remonte la case non contrôlée, effaçant un tap fait entre-temps (fenêtre de quelques centaines de ms, édition uniquement). Correctif : attendre `idsLies` avant d'afficher la liste en édition. Sûr : oui.

## Options structurantes (non appliquées)

1. **Progression visible dans la liste.** Les cartes n'affichent ni avancement ni coche (`ObjectifCard.tsx:102-115`), alors qu'un objectif se consulte pour savoir « où j'en suis ». Un `ProgressRing` ou une barre fine par carte (étapes faites, % valeur) répondrait à Purpose.
2. **Retirer « Modifier » et « Suppr. » des cartes de liste.** L'en-tête de détail les propose déjà ; les garder double la surface tactile destructive à côté du lien principal.
3. **Replier les groupes « Atteints » et « Abandonnés »** et placer la carte « Ajouter un objectif » après la liste ou en bouton flottant : consulter prime sur créer (`ObjectifsList.tsx:36-60`, `AddObjectifToggle.tsx`).
4. **Un seul contrôle de statut pour le type « Fait / pas fait »** : le bouton de `ObjectifSuiviBinaire` et le segmenté de l'en-tête sont deux commandes du même état.
5. **Libellé « Abandonné »** (`ObjectifsList.tsx:23`, `ObjectifHeader.tsx:18`) : vocabulaire d'échec au regard du ton « tableau de bord doux » ; alternative « Mis de côté ». Changement de vocabulaire, à valider avec Vincent.
6. **Rangée d'étape entièrement tactile** (coche + titre en un seul bouton de 44 px) pour porter le geste le plus fréquent à 44 px réels au lieu des 28 px actuels (`hitSlop={3}`).

## Déjà couvert par l'audit du 2026-11-07

- Champ « Nouvelle étape… » sans nom accessible : `objectifs/[id]/ObjectifSuiviEtapes.tsx:169`, listé « à vérifier » en I1. Confirmé : placeholder seul, aucun `<label>` ni `aria-label`. Correctif de l'audit applicable tel quel (`aria-label="Nouvelle étape"`).
- Liste d'habitudes de `ObjectifForm.tsx:58-59` non invalidée à la création ou l'archivage d'une habitude (décalage de 30 s) : cité en ligne 680 du rapport.
- Clés de cache `objectifs` / `objectif(id)` désormais invalidées ensemble : déjà traité (CLICK-PATH-501, commentaires dans `ObjectifCard.tsx`, `ObjectifHeader.tsx`, `ObjectifSuiviBinaire.tsx`), non refait.

Fichier de rapport : `/home/user/Kilio/reports/2026-11-12-audit-design-objectifs.md`
