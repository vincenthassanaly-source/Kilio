import { createElement, type ReactNode } from "react";

// Registre unique de tous les items navigables de Kilio : les 4 modules
// "primaires" (historiquement codés en dur dans BottomNav.ITEMS) et les 7
// modules "secondaires" (historiquement MODULES dans src/lib/modules.ts).
// src/lib/modules.ts et BottomNav lisent tous les deux ce registre, pour
// que la personnalisation de navigation (préférences_navigation) puisse
// épingler n'importe quel item dans n'importe quel emplacement.
export type NavItem = {
  href: string;
  label: string;
  /** Non utilisée par BottomNav (icônes seules) : uniquement pour la grille "Plus". */
  description?: string;
  icon: (color: string) => ReactNode;
  accentVar: string;
};

// Comportement actuel préservé si Vincent ne personnalise rien (voir
// migration-preferences-navigation-2026-09-04.sql).
export const DEFAULT_MODULES_BARRE_BASSE: readonly string[] = ["/", "/nutrition", "/taches", "/habitudes"];

const ACCUEIL_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", { d: "M4 11.5 12 4l8 7.5" }),
    createElement("path", { d: "M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" })
  );

const NUTRITION_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", { d: "M4 6c2.4-1.6 5.6-1.6 8 0v13c-2.4-1.6-5.6-1.6-8 0V6z" }),
    createElement("path", { d: "M20 6c-2.4-1.6-5.6-1.6-8 0v13c2.4-1.6 5.6-1.6 8 0V6z" })
  );

const TACHES_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("rect", { x: 3.5, y: 3.5, width: 17, height: 17, rx: 3 }),
    createElement("path", { d: "M7.5 12.5l2.5 2.5 6-6" })
  );

const HABITUDES_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", {
      d: "M12 3.5c1.2 2.6-.4 3.9-1.4 5-1.3 1.4-1.9 2.7-1.9 4.2a5.3 5.3 0 0 0 10.6 0c0-1.9-1-3.4-2.1-4.5.2 1.6-.5 2.3-1.2 2.3-1 0-1.4-.9-1.1-2 .4-1.5.4-3.2-2.9-5z",
    })
  );

const AGENDA_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("rect", { x: 3.5, y: 4.5, width: 17, height: 16, rx: 3 }),
    createElement("path", { d: "M3.5 9.5h17" }),
    createElement("path", { d: "M8 3v3M16 3v3" })
  );

const COURSES_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", { d: "M7 8V6a5 5 0 0 1 10 0v2" }),
    createElement("path", { d: "M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5L5.5 8z" })
  );

const BUDGET_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("rect", { x: 3.5, y: 6.5, width: 17, height: 12.5, rx: 2.5 }),
    createElement("path", { d: "M3.5 10.5h17" }),
    createElement("circle", { cx: 16.5, cy: 14.5, r: 1.1, fill: c, stroke: "none" })
  );

const OBJECTIFS_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("circle", { cx: 12, cy: 12, r: 8.5 }),
    createElement("circle", { cx: 12, cy: 12, r: 4.5 }),
    createElement("circle", { cx: 12, cy: 12, r: 0.8, fill: c })
  );

const COLLECTION_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", { d: "M8.5 20.5h9a2 2 0 0 0 2-2v-9" }),
    createElement("rect", { x: 3.5, y: 3.5, width: 12.5, height: 12.5, rx: 2.5 }),
    createElement("circle", { cx: 7.2, cy: 7.2, r: 1, fill: c, stroke: "none" }),
    createElement("path", { d: "M4.5 13l2.7-3.1 3 3.3 2-2.2 3.3 3.5" })
  );

const NOTES_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", { d: "M6 3.5h9l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" }),
    createElement("path", { d: "M9 9.5h6M9 13h6M9 16.5h3.5" })
  );

const REGLAGES_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("circle", { cx: 12, cy: 12, r: 3 }),
    createElement("path", {
      d: "M19.4 13.5c.1-.5.1-1 0-1.5l1.6-1.2-1.5-2.6-1.9.6a5.4 5.4 0 0 0-1.3-.75l-.3-2H10l-.3 2a5.4 5.4 0 0 0-1.3.75l-1.9-.6-1.5 2.6 1.6 1.2c-.1.5-.1 1 0 1.5l-1.6 1.2 1.5 2.6 1.9-.6c.4.3.85.55 1.3.75l.3 2h4l.3-2c.45-.2.9-.45 1.3-.75l1.9.6 1.5-2.6z",
    })
  );

const CARBURANTS_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("rect", { x: 4.5, y: 4.5, width: 9.5, height: 15, rx: 2 }),
    createElement("path", { d: "M7 8.5h4.5" }),
    createElement("path", { d: "M14 10.5h2.3a1.7 1.7 0 0 1 1.7 1.7v4.3a1.5 1.5 0 0 0 3 0v-6l-2.2-2.2" }),
    createElement("path", { d: "M18.5 10.5v-1a1 1 0 0 0-1-1h-.5" })
  );

const DOCUMENTS_ICON = (c: string) =>
  createElement(
    "svg",
    { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", {
      d: "M3.5 8.5a2 2 0 0 1 2-2h4.2l2 2.2h6.8a2 2 0 0 1 2 2v7.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
    }),
    createElement("path", { d: "M9.7 13.2a2.3 2.3 0 1 1 4.6 0v1.3" }),
    createElement("rect", { x: 9.2, y: 14.5, width: 5.6, height: 4, rx: 1 })
  );

// Ordre canonique : les 4 modules primaires (épinglés en barre du bas par
// défaut) puis les 7 modules secondaires. La grille "Plus" liste TOUJOURS
// les 11 items (voir resolveOrdreGrillePlus dans
// src/app/actions/preferences-navigation.ts) : un module reste accessible
// depuis /plus même s'il est aussi épinglé en barre du bas, pour ne jamais
// perdre l'accès à un module qu'on aurait délogé de la barre du bas (ex.
// Nutrition ou Habitudes remplacées par un autre module épinglé). L'ordre
// réel affiché à Vincent est piloté par preferences_navigation, résolu par
// resolveOrdreGrillePlus / resolveModulesBarreBasse dans
// src/app/actions/preferences-navigation.ts.
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Accueil",
    description: "Tableau de bord du jour",
    icon: ACCUEIL_ICON,
    accentVar: "var(--accent-kcal)",
  },
  {
    href: "/nutrition",
    label: "Nutrition",
    description: "Journal alimentaire et macros",
    icon: NUTRITION_ICON,
    accentVar: "var(--accent-kcal)",
  },
  {
    href: "/taches",
    label: "Tâches",
    description: "Listes de tâches et sous-tâches",
    icon: TACHES_ICON,
    accentVar: "var(--accent-kcal)",
  },
  {
    href: "/habitudes",
    label: "Habitudes",
    description: "Suivi quotidien de tes habitudes",
    icon: HABITUDES_ICON,
    accentVar: "var(--accent-kcal)",
  },
  {
    href: "/agenda",
    label: "Agenda",
    description: "Vues calendrier des tâches à échéance",
    accentVar: "var(--accent-agenda)",
    icon: AGENDA_ICON,
  },
  {
    href: "/courses",
    label: "Courses",
    description: "Liste de courses",
    accentVar: "var(--accent-courses)",
    icon: COURSES_ICON,
  },
  {
    href: "/budget",
    label: "Budget",
    description: "Comptes, dépenses et budgets par catégorie",
    accentVar: "var(--accent-budget)",
    icon: BUDGET_ICON,
  },
  {
    href: "/objectifs",
    label: "Objectifs",
    description: "Objectifs perso et pro, avec échéance",
    accentVar: "var(--accent-objectifs)",
    icon: OBJECTIFS_ICON,
  },
  {
    href: "/collection",
    label: "Collection",
    description: "Photos organisées par collection",
    accentVar: "var(--accent-collection)",
    icon: COLLECTION_ICON,
  },
  {
    href: "/notes",
    label: "Notes",
    description: "Notes libres",
    accentVar: "var(--accent-protein)",
    icon: NOTES_ICON,
  },
  {
    href: "/reglages",
    label: "Réglages",
    description: "Profil, apparence et préférences",
    accentVar: "var(--accent-reglages)",
    icon: REGLAGES_ICON,
  },
  {
    href: "/carburants",
    label: "Carburants",
    accentVar: "var(--accent-carburants)",
    icon: CARBURANTS_ICON,
  },
  {
    href: "/documents",
    label: "Documents",
    description: "Papiers importants et échéances",
    accentVar: "var(--accent-documents)",
    icon: DOCUMENTS_ICON,
  },
];

export function findNavItem(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href);
}

// Routes "racine" de module au sens de la navigation top-level (voir
// useViewTransitionNavigate) : les 11 items du registre, plus /plus elle-même
// — pas un module au sens strict, mais un écran de même niveau que les autres
// dans la barre du bas, d'où l'on peut aussi rejoindre n'importe quel module
// non épinglé. Match exact uniquement (pas de sous-route type /taches/abc),
// pour ne jamais transformer un drill-down en racine-à-racine.
const ROOT_MODULE_PATHS = new Set<string>([...NAV_ITEMS.map((item) => item.href), "/plus"]);

export function isModuleRootPath(pathname: string): boolean {
  return ROOT_MODULE_PATHS.has(pathname);
}

// Résout le href navigable le plus spécifique pour un pathname donné
// (ex. "/taches/123" -> "/taches"), pour déterminer quel onglet mettre en
// surbrillance dans BottomNav quel que soit l'emplacement où un module est
// épinglé.
export function resolveActiveHref(pathname: string): string | null {
  let best: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    const matches = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.href ?? null;
}
