// Query keys TanStack Query centralisées : partagées entre les modules qui
// lisent la même donnée (ex. tâches du jour affichées à la fois sur le
// dashboard et dans /taches) pour que toggler une tâche depuis l'une
// invalide/actualise correctement le cache lu par l'autre.
export const queryKeys = {
  taches: ["taches"] as const,
  listes: ["listes"] as const,
  tags: ["tags"] as const,
  notes: ["notes"] as const,
  courses: ["courses"] as const,
  habitudes: (date: string) => ["habitudes", date] as const,
  // Historique mensuel d'une habitude (vue calendrier) : clé par habitude +
  // mois (premier jour du mois, format ISO) pour que changer d'habitude ou
  // naviguer d'un mois à l'autre déclenche un nouveau fetch distinct.
  historiqueHabitude: (habitudeId: string, mois: string) => ["historique-habitude", habitudeId, mois] as const,
  journal: (date: string, jourType: string) => ["journal", date, jourType] as const,
  // Résumé nutritionnel d'une date (consommé + cible du type de jour
  // mémorisé) : invalidé après un ajout de repas ou un changement de type.
  resumeNutrition: (date: string) => ["resume-nutrition", date] as const,
  catalogueJournal: ["catalogue-journal"] as const,
  objectifs: ["objectifs"] as const,
  objectif: (id: string) => ["objectif", id] as const,
  collections: ["collections"] as const,
  collection: (id: string) => ["collection", id] as const,
  // Sans mutation côté app (écrites uniquement hors Server Action, cf.
  // skill kilio-planning-travail) : voir AgendaView pour le staleTime dédié.
  planningTravail: ["planning-travail"] as const,
  planningTravailExceptions: ["planning-travail-exceptions"] as const,
};
