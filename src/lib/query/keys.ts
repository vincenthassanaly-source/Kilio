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
  vinted: ["vinted"] as const,
  vintedAnnonce: (id: string) => ["vinted", id] as const,
  vintedReglages: ["vinted-reglages"] as const,
  opinions: ["opinions"] as const,
  opinionsIdee: (id: string) => ["opinions", id] as const,
  // Sous la racine `opinions` : un tirer-pour-rafraîchir invalide aussi partis et priorités.
  opinionsPartis: ["opinions", "partis"] as const,
  opinionsPriorites: ["opinions", "priorites"] as const,
  collections: ["collections"] as const,
  collection: (id: string) => ["collection", id] as const,
  // Sans mutation côté app (écrites uniquement hors Server Action, cf.
  // skill kilio-planning-travail) : voir AgendaView pour le staleTime dédié.
  // Événements légers de l'agenda, par jour (écran Aujourd'hui) ou par plage
  // (Agenda) : toute écriture invalide la racine `evenements`.
  evenements: ["evenements"] as const,
  evenementsDuJour: (date: string) => ["evenements", date] as const,
  evenementsPlage: (debut: string, fin: string) => ["evenements", debut, fin] as const,
  // Séances de sport de la semaine en cours (créneaux + occurrences) : clé par
  // jour pour repartir d'une semaine neuve passé minuit.
  // Bilan de la semaine (kcal moyens, séances, poids, taille) et derniers
  // relevés du corps : invalidés après une pesée.
  syntheseSemaine: (today: string) => ["synthese-semaine", today] as const,
  synthesesSemaine: ["synthese-semaine"] as const,
  mesuresRecentes: ["mesures-recentes"] as const,
  // Jours libres (jetons) autour d'aujourd'hui : posés/retirés depuis Aujourd'hui.
  joursLibres: ["jours-libres"] as const,
  joursLibresAutour: (today: string) => ["jours-libres", today] as const,
  // Jours fériés FR (lecture seule, copie locale de l'API Etalab) sur une plage.
  joursFeries: (debut: string, fin: string) => ["jours-feries", debut, fin] as const,
  seances: ["seances"] as const,
  seancesSemaine: (today: string) => ["seances", today] as const,
  musculationExercices: ["musculation-exercices"] as const,
  musculationRoutines: ["musculation-routines"] as const,
  musculationHistorique: (limite: number) => ["musculation-historique", limite] as const,
  musculationEntrainement: (id: string) => ["musculation-entrainement", id] as const,
  musculationResume: (type: string, decalage: number) => ["musculation-resume", type, decalage] as const,
  musculationExercicesPratiques: ["musculation-exercices-pratiques"] as const,
  musculationStatsExercice: (id: string) => ["musculation-stats-exercice", id] as const,
  musculationRoutine: (id: string) => ["musculation-routine", id] as const,
  planningTravail: ["planning-travail"] as const,
  planningTravailExceptions: ["planning-travail-exceptions"] as const,
};
