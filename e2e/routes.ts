// Routes principales guardées par les tests instant() — voir instant-nav.rig.md.
// `title` : texte exact du <h1> de la page, tel qu'il figure dans la coquille
// (en-tête statique de la page, ou son loading.tsx quand la page entière
// attend une donnée), vérifié dans le code source. `shell` sert de marqueur quand le <h1> n'est
// pas statique (Dashboard : salutation selon l'heure).
export type RouteContract = {
  path: string;
  title?: string;
  shellTestId?: string;
};

export const ROUTES: RouteContract[] = [
  { path: "/", shellTestId: "dashboard-shell" },
  { path: "/taches", title: "Tâches" },
  { path: "/taches/listes", title: "Listes & tags" },
  { path: "/nutrition/journal", title: "Carnet alimentaire" },
  { path: "/habitudes", title: "Habitudes" },
  { path: "/courses", title: "Courses" },
  { path: "/notes", title: "Notes" },
  { path: "/agenda", title: "Agenda" },
  { path: "/aujourdhui", title: "Aujourd'hui" },
  { path: "/nutrition/recettes", title: "Recettes" },
  { path: "/objectifs", title: "Objectifs" },
  { path: "/documents", title: "Documents" },
  { path: "/collection", title: "Collection" },
  { path: "/pharmacie", title: "Pharmacie" },
  { path: "/musculation", title: "Musculation" },
  { path: "/plus", title: "Plus" },
  { path: "/reglages", title: "Réglages" },
  // Ajoutées le 2026-11-04 (mission de nuit performance) : routes principales
  // du menu Plus et des sous-navigations qui n'étaient gardées par aucun test.
  { path: "/nutrition", title: "Nutrition" },
  { path: "/nutrition/menus", title: "Menus" },
  { path: "/nutrition/bilan", title: "Bilan" },
  { path: "/revue", title: "Revue de la semaine" },
  { path: "/scanner", title: "Scanner" },
  { path: "/opinions", title: "Opinions" },
  { path: "/musculation/historique", title: "Historique" },
  { path: "/musculation/stats", title: "Statistiques" },
  { path: "/documents/categories", title: "Catégories" },
  { path: "/pharmacie/revision", title: "Révision" },
];
