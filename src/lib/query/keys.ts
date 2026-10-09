// Query keys TanStack Query centralisées : partagées entre les modules qui
// lisent la même donnée (ex. tâches du jour affichées à la fois sur le
// dashboard et dans /taches) pour que toggler une tâche depuis l'une
// invalide/actualise correctement le cache lu par l'autre.
export const queryKeys = {
  taches: ["taches"] as const,
  listes: ["listes"] as const,
  tags: ["tags"] as const,
  notes: ["notes"] as const,
  pharmacie: ["pharmacie"] as const,
  pharmacieReferentiel: ["pharmacie-referentiel"] as const,
  courses: ["courses"] as const,
  habitudes: (date: string) => ["habitudes", date] as const,
  // Historique mensuel d'une habitude (vue calendrier) : clé par habitude +
  // mois (premier jour du mois, format ISO) pour que changer d'habitude ou
  // naviguer d'un mois à l'autre déclenche un nouveau fetch distinct.
  historiqueHabitude: (habitudeId: string, mois: string) => ["historique-habitude", habitudeId, mois] as const,
  // Résumé nutritionnel d'une date (consommé + cible du type de jour,
  // marqué dans le Journal) : invalidé après un ajout de repas ou une
  // modification des objectifs.
  resumeNutrition: (date: string) => ["resume-nutrition", date] as const,
  catalogueJournal: ["catalogue-journal"] as const,
  objectifs: ["objectifs"] as const,
  objectif: (id: string) => ["objectif", id] as const,
  // Habitudes proposées au rattachement + habitudes déjà liées à un objectif.
  habitudesActives: ["habitudes-actives"] as const,
  habitudesDeLObjectif: (id: string) => ["habitudes-de-l-objectif", id] as const,
  collections: ["collections"] as const,
  collection: (id: string) => ["collection", id] as const,
  // Sans mutation côté app (écrites uniquement hors Server Action, cf.
  // skill kilio-planning-travail) : voir AgendaView pour le staleTime dédié.
  // Événements légers de l'agenda, par jour (écran Aujourd'hui) ou par plage
  // (Agenda) : toute écriture invalide la racine `evenements`.
  evenements: ["evenements"] as const,
  evenementsDuJour: (date: string) => ["evenements", date] as const,
  evenementsPlage: (debut: string, fin: string) => ["evenements", debut, fin] as const,
  // Inbox : liste à trier, et son compteur (pastilles « Plus » / « + »).
  inbox: ["inbox"] as const,
  inboxCount: ["inbox", "count"] as const,
  planningTravail: ["planning-travail"] as const,
  planningTravailExceptions: ["planning-travail-exceptions"] as const,
};
