// Shared Tailwind class fragments for the "Kilio — mobile" design system.
// Keeps cards/buttons/inputs visually consistent across screens.

export const card = "rounded-[22px] border border-line bg-surface p-4 shadow-card";
// `cardTight` : toujours une ligne de liste (un ingrédient, une étape, une
// entrée de journal...), jamais un conteneur groupant plusieurs éléments
// indépendants — press state ajouté sans risque de doublon avec un enfant.
// `card` (ci-dessus), lui, sert aussi bien de conteneur de groupe (ex.
// DashboardTachesSection, qui rassemble plusieurs tâches sous un seul
// conteneur `card`) que de formulaire (Add*Toggle) : y ajouter
// `active:scale` ferait "trembler" tout le groupe/formulaire au moindre tap
// sur un champ ou un bouton interne, pas seulement l'élément pressé — non
// modifié ici pour cette raison (voir reports/2026-09-13-fluidite-4-chantiers.md).
export const cardTight = "rounded-[20px] border border-line bg-surface p-3.5 shadow-card transition active:scale-[0.97]";

// `text-balance` (T-polish) : titres courts (1-3 lignes) répartis plus
// régulièrement entre les lignes, pour éviter une dernière ligne orpheline
// d'un seul mot sur les libellés longs (ex. noms de catégories/objectifs).
export const screenTitle = "font-display text-2xl font-bold text-ink tracking-tight text-balance";
export const sectionTitle = "text-[15px] font-bold text-ink text-balance";
export const eyebrow = "text-[12.5px] font-semibold text-ink-3";

// `focus-visible:ring-*` (jamais `focus:`, pour ne pas afficher l'anneau au
// clic souris/tap) : anneau détaché du fond (`ring-offset-2`) donc visible
// quel que soit le fond du bouton, y compris sur `primaryButton` (bg-kcal).
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

// 16 px (et non 15) : en dessous, iOS zoome la page au focus d'un champ (T15).
export const input = `rounded-2xl border border-line bg-surface-alt px-3.5 py-2.5 text-base text-ink outline-none focus:border-kcal/60 transition-colors ${focusRing}`;
export const label = "text-sm font-medium text-ink";
export const errorText = "text-sm text-alert";

export const primaryButton =
  `rounded-2xl bg-kcal px-4 py-2.5 font-semibold text-on-kcal transition active:scale-[0.97] disabled:opacity-60 ${focusRing}`;
export const secondaryButton =
  `rounded-2xl border border-line bg-surface px-4 py-2.5 font-semibold text-ink transition active:scale-[0.97] disabled:opacity-60 ${focusRing}`;
export const addCard =
  `flex w-full items-center gap-[13px] rounded-[22px] border border-line bg-surface p-4 shadow-card text-left transition-transform active:scale-[0.99] ${focusRing}`;
// Icône « + » des cartes d'ajout (T9) : aplat vert Kcal, sans le dégradé ni
// la seconde ombre colorée copiés-collés dans chaque *Toggle (Single Shadow
// Rule, One Accent Rule) — un seul endroit à modifier désormais.
export const addCardIcon =
  "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] bg-kcal text-on-kcal text-lg font-semibold";

// Zone de tap étendue à 44 px de haut (T6) sans grossir le bouton visible :
// pseudo-élément transparent débordant de 6 px en haut et en bas (le bouton
// fait ≈ 32 px). Les lignes de liste qui les accueillent ont toutes au moins
// 12 px d'espace vertical, donc pas de chevauchement.
const zoneTap44 = "relative after:absolute after:inset-x-0 after:-inset-y-1.5";

export const ghostButton =
  `${zoneTap44} rounded-xl border border-line px-2.5 py-1.5 text-sm font-medium text-ink transition active:scale-[0.97] hover:bg-surface-alt ${focusRing}`;
// Variante de `ghostButton` dédiée aux flèches de navigation de période
// (Agenda : jour/semaine/mois précédent-suivant) — cible tactile 44×44px
// minimum (h-11 w-11), contrairement à `ghostButton` (compact, utilisé
// ailleurs dans l'app) qu'on ne modifie pas pour ne pas grossir tous ses
// autres usages.
export const navArrowButton =
  `flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink transition active:scale-[0.97] hover:bg-surface-alt ${focusRing}`;
export const dangerButton =
  `${zoneTap44} rounded-xl border border-alert/30 px-2.5 py-1.5 text-sm font-medium text-alert transition active:scale-[0.97] disabled:opacity-60 ${focusRing}`;
export const linkButton = `relative after:absolute after:-inset-x-2 after:-inset-y-3 text-sm font-semibold text-kcal ${focusRing}`;

// Zone de tap étendue des pills compacts cliquables (chips de filtre,
// « + sous-tâches » : ≈ 25 px de haut) à ≈ 41 px, sans grossir le pill visible.
// Le pseudo-élément déborde de 8 px en haut et en bas ; les conteneurs qui
// l'utilisent gardent donc au moins 16 px entre deux rangées de pills pour ne
// jamais chevaucher la zone du voisin.
export const zoneTapPill = "relative after:absolute after:inset-x-0 after:-inset-y-2";

export const pillTag =
  "shrink-0 rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold text-ink-2";
export const kcalPillTag =
  "shrink-0 rounded-full bg-kcal-soft px-2.5 py-1 text-[11px] font-bold text-kcal";

// Toujours une ligne de liste représentant une seule entité (une tâche, un
// objectif, une transaction...), jamais un groupe : même raisonnement que
// `cardTight` ci-dessus.
export const listCard =
  "flex flex-col gap-1.5 rounded-[20px] border border-line bg-surface p-3.5 shadow-card transition active:scale-[0.97]";

export const checkCircle =
  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2";

export const nameText = "text-[14.5px] font-semibold text-ink truncate";
export const metaText = "text-xs text-ink-2 font-mono";
