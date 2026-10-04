// Routes principales guardées par les tests instant() — voir instant-nav.rig.md.
// `title` : texte exact du <h1> de la page (identique dans son loading.tsx),
// vérifié dans le code source. `shell` sert de marqueur quand le <h1> n'est
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
  { path: "/nutrition/journal", title: "Journal" },
  { path: "/habitudes", title: "Habitudes" },
  { path: "/courses", title: "Courses" },
  { path: "/notes", title: "Notes" },
  { path: "/agenda", title: "Agenda" },
  { path: "/budget", title: "Vue d'ensemble" },
  { path: "/budget/transactions", title: "Transactions" },
  { path: "/budget/comptes", title: "Comptes" },
  { path: "/budget/categories", title: "Catégories" },
  { path: "/budget/statistiques", title: "Statistiques" },
  { path: "/budget/recurrentes", title: "Transactions récurrentes" },
  { path: "/budget/calendrier", title: "Calendrier" },
  { path: "/nutrition/recettes", title: "Recettes" },
  { path: "/objectifs", title: "Objectifs" },
  { path: "/documents", title: "Documents" },
  { path: "/collection", title: "Collection" },
  { path: "/pharmacie", title: "Pharmacie" },
  { path: "/plus", title: "Plus" },
  { path: "/reglages", title: "Réglages" },
];
