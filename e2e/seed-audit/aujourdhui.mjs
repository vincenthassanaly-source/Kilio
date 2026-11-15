// Seed d'audit de l'écran du jour (« Aujourd'hui », route `/`). Données FICTIVES.
//
// Une journée vivante : tâches du jour (avec et sans heure, une faite, une au
// titre très long, sous-tâches, tags), tâches en retard, à venir et sans date ;
// habitudes quotidiennes, hebdomadaires et quantifiée avec historique ; routines
// Push / Pull / Legs et entraînements de la semaine ; événements du jour (dont
// un le soir pour que la frise reste dépliée, et une journée entière) ; horaires
// de travail ; relevés de poids anciens (la pesée est due) ; jours fériés.
// Les repas du jour, aliments, recettes et objectifs viennent de
// e2e/mock-supabase.mjs (journal_repas, objectifs_nutritionnels).
//
// Les autres modules réutilisent ces lignes : ne pas réutiliser les ids
// `…a1xx` (tâches), `…a2xx` (habitudes), `…a3xx` (musculation), `…a4xx` (agenda).

const ts = "2026-09-01T00:00:00+00:00";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const id = (prefixe, n) => `00000000-0000-4000-8000-000000${prefixe}${String(n).padStart(3, "0")}`;

// --- Tâches -----------------------------------------------------------------
const LISTE_PERSO = uuid(1); // « Perso », déjà dans mock-supabase.mjs
const LISTE_MAISON = id("a10", 1);
const LISTE_ADMIN = id("a10", 2);
const LISTE_TRAVAIL = id("a10", 3);

const TAG_URGENT = id("a11", 1);
const TAG_TELEPHONE = id("a11", 2);
const TAG_WEEKEND = id("a11", 3);

const tache = (n, titre, extra = {}) => ({
  id: id("a12", n),
  titre,
  echeance: null,
  fait: false,
  heure: null,
  heure_fin: null,
  duree_minutes: null,
  liste_id: LISTE_PERSO,
  note_id: null,
  notes: null,
  ordre: n,
  priorite: "aucune",
  programme_jour: false,
  rappel_envoye_le: null,
  rappel_minutes: null,
  rappel_reporte_jusqua: null,
  recurrence_fin: null,
  recurrence_frequence: null,
  termine_le: null,
  toute_la_journee: false,
  created_at: ts,
  updated_at: ts,
  ...extra,
});

const taches = [
  // Du jour
  tache(1, "Appeler le cabinet dentaire pour déplacer le détartrage", { echeance: "__TODAY__", heure: "11:30:00", heure_fin: "11:45:00", priorite: "haute", liste_id: LISTE_ADMIN }),
  tache(2, "Préparer les repas de la semaine", { echeance: "__TODAY__", heure: "19:30:00", heure_fin: "20:30:00", liste_id: LISTE_MAISON }),
  tache(3, "Lancer une lessive de draps", { echeance: "__TODAY__", liste_id: LISTE_MAISON }),
  tache(4, "Renvoyer le colis de chaussures trop petites au point relais avant la fermeture, penser à imprimer l'étiquette de retour et à garder le reçu", { echeance: "__TODAY__", priorite: "moyenne" }),
  tache(5, "Arroser les plantes du salon", { echeance: "__TODAY__", fait: true, termine_le: "__TODAY__T08:10:00+00:00", liste_id: LISTE_MAISON }),
  tache(6, "Relire le compte rendu de la réunion d'équipe", { echeance: "__TODAY__", heure: "21:45:00", heure_fin: "22:15:00", liste_id: LISTE_TRAVAIL, notes: "Vérifier les actions qui me sont attribuées." }),
  tache(7, "Sortir les poubelles jaunes", { echeance: "__TODAY__", recurrence_frequence: "hebdomadaire", liste_id: LISTE_MAISON }),
  // En retard
  tache(8, "Payer la facture d'électricité", { echeance: "__DAY(-1)__", priorite: "haute", liste_id: LISTE_ADMIN }),
  tache(9, "Prendre rendez-vous pour le contrôle technique", { echeance: "__DAY(-3)__", liste_id: LISTE_ADMIN }),
  tache(10, "Rapporter les livres à la médiathèque", { echeance: "__DAY(-6)__" }),
  tache(11, "Répondre au message de la copropriété au sujet des travaux de ravalement de la façade", { echeance: "__DAY(-12)__", priorite: "basse", liste_id: LISTE_ADMIN }),
  // À venir
  tache(12, "Acheter un cadeau d'anniversaire pour Camille", { echeance: "__DAY(1)__" }),
  tache(13, "Réviser le chapitre sur les antibiotiques", { echeance: "__DAY(2)__", heure: "18:00:00", heure_fin: "19:00:00" }),
  tache(14, "Déclarer le changement d'adresse à l'assurance", { echeance: "__DAY(5)__", liste_id: LISTE_ADMIN }),
  tache(15, "Nettoyer le filtre de la hotte", { echeance: "__DAY(9)__", liste_id: LISTE_MAISON }),
  // Sans date
  tache(16, "Trier les photos de vacances", {}),
  tache(17, "Chercher un nouveau matelas", { liste_id: LISTE_MAISON }),
  // Terminées (jours passés)
  tache(18, "Commander les croquettes du chat", { echeance: "__DAY(-2)__", fait: true, termine_le: "__DAY(-2)__T17:00:00+00:00" }),
  tache(19, "Envoyer l'attestation à la mutuelle", { echeance: "__DAY(-4)__", fait: true, termine_le: "__DAY(-4)__T09:30:00+00:00", liste_id: LISTE_ADMIN }),
];

// --- Habitudes --------------------------------------------------------------
const H_EAU = id("a20", 1);
const H_LECTURE = id("a20", 2);
const H_ETIREMENTS = id("a20", 3);
const H_COURSE = id("a20", 4);
const H_MEDITATION = id("a20", 5);
const H_ECRANS = id("a20", 6);
const H_ARCHIVEE = id("a20", 7);

const habitude = (hid, nom, ordre, extra = {}) => ({
  id: hid,
  nom,
  ordre,
  actif: true,
  archivee_le: null,
  frequence_hebdo: null,
  icone: null,
  type: "boolean",
  unite: null,
  valeur_cible: null,
  created_at: "__DAY(-60)__T08:00:00+00:00",
  updated_at: "__DAY(-60)__T08:00:00+00:00",
  ...extra,
});

const habitudes = [
  habitude(H_EAU, "Boire 2 litres d'eau", 0, { type: "quantifiee", unite: "verres", valeur_cible: 8, icone: "💧" }),
  habitude(H_LECTURE, "Lire 20 minutes", 1, { type: "streak", icone: "📚" }),
  habitude(H_ETIREMENTS, "Étirements du matin", 2, { type: "streak", icone: "🧘" }),
  habitude(H_COURSE, "Courir", 3, { frequence_hebdo: 3, icone: "🏃" }),
  habitude(H_MEDITATION, "Méditer dix minutes avant de dormir, sans téléphone dans la chambre", 4, { type: "boolean" }),
  habitude(H_ECRANS, "Pas d'écran après 22 h", 5, { frequence_hebdo: 5 }),
  habitude(H_ARCHIVEE, "Prendre les escaliers", 6, { actif: false, archivee_le: "__DAY(-20)__T08:00:00+00:00" }),
];

let nEntree = 0;
const entree = (habitude_id, jour, valeur = 1) => ({
  id: id("a21", ++nEntree),
  habitude_id,
  date: jour === 0 ? "__TODAY__" : `__DAY(${jour})__`,
  valeur,
  created_at: ts,
});
const jours = (debut, fin, sauf = []) => {
  const liste = [];
  for (let j = debut; j <= fin; j++) if (!sauf.includes(j)) liste.push(j);
  return liste;
};

const habitude_entries = [
  // Eau : cible 8 verres ; 5 aujourd'hui (en cours), atteinte la plupart des jours passés.
  entree(H_EAU, 0, 5),
  ...jours(-14, -1).map((j) => entree(H_EAU, j, j % 4 === 0 ? 6 : 8)),
  // Lecture : série de 12 jours jusqu'à hier, pas encore faite aujourd'hui.
  ...jours(-12, -1).map((j) => entree(H_LECTURE, j)),
  // Étirements : déjà faits aujourd'hui, série de 5 jours.
  ...jours(-4, 0).map((j) => entree(H_ETIREMENTS, j)),
  ...jours(-20, -7, [-13, -10]).map((j) => entree(H_ETIREMENTS, j)),
  // Courir (3 par semaine) : 2 fois cette semaine, objectif tenu les 3 semaines d'avant.
  ...[-5, -2, -8, -10, -12, -15, -17, -19, -22, -24, -26].map((j) => entree(H_COURSE, j)),
  // Méditation : irrégulière.
  ...[-1, -3, -4, -9].map((j) => entree(H_MEDITATION, j)),
  // Écrans (5 par semaine) : 3 fois cette semaine.
  ...[-6, -4, -1, -8, -9, -10, -11, -13].map((j) => entree(H_ECRANS, j)),
];

// --- Musculation : routines Push / Pull / Legs --------------------------------
const exercice = (n, nom, muscle, materiel) => ({
  id: id("a30", n),
  nom,
  muscle_principal: muscle,
  muscles_secondaires: [],
  materiel,
  mode_saisie: "poids_reps",
  animation: null,
  repos_defaut_s: 90,
  created_at: ts,
  updated_at: ts,
});
const exercices = [
  exercice(1, "Développé couché", "pectoraux", "barre"),
  exercice(2, "Développé militaire", "epaules", "haltères"),
  exercice(3, "Extension triceps à la poulie", "triceps", "poulie"),
  exercice(4, "Tractions", "dos", "poids du corps"),
  exercice(5, "Rowing barre", "dos", "barre"),
  exercice(6, "Curl haltères", "biceps", "haltères"),
  exercice(7, "Squat", "quadriceps", "barre"),
  exercice(8, "Soulevé de terre jambes tendues", "ischios", "barre"),
  exercice(9, "Presse à cuisses", "quadriceps", "machine"),
];

const routine = (n, nom, type_seance, ordre) => ({
  id: id("a31", n),
  nom,
  type_seance,
  ordre,
  dossier_id: null,
  created_at: ts,
  updated_at: ts,
});
const routines = [
  routine(1, "Push A", "PUSH", 0),
  routine(2, "Push B", "PUSH", 1),
  routine(3, "Pull A", "PULL", 2),
  routine(4, "Pull B", "PULL", 3),
  routine(5, "Legs A", "LEGS", 4),
  routine(6, "Legs B (sans exercice)", "LEGS", 5),
  routine(7, "Gainage express", null, 6),
];
let nRoutineExercice = 0;
const lier = (routineN, exerciceNs) =>
  exerciceNs.map((e, ordre) => ({
    id: id("a32", ++nRoutineExercice),
    routine_id: id("a31", routineN),
    exercice_id: id("a30", e),
    ordre,
    repos_s: 90,
    created_at: ts,
  }));
const routine_exercices = [
  ...lier(1, [1, 2, 3]),
  ...lier(2, [2, 1, 3]),
  ...lier(3, [4, 5, 6]),
  ...lier(4, [5, 4, 6]),
  ...lier(5, [7, 8, 9]),
];

const entrainement = (n, jour, titre, routineN, type_seance) => ({
  id: id("a33", n),
  date: `__DAY(${jour})__`,
  titre,
  routine_id: routineN ? id("a31", routineN) : null,
  type_seance,
  debut_at: `__DAY(${jour})__T17:00:00+00:00`,
  fin_at: `__DAY(${jour})__T18:05:00+00:00`,
  duree_s: 3900,
  created_at: ts,
  updated_at: ts,
});
// Un Push il y a 2 jours (dans la semaine en cours du jeudi au dimanche), le
// reste les semaines précédentes.
const entrainements = [
  entrainement(1, -2, "Push A", 1, "PUSH"),
  entrainement(2, -8, "Legs A", 5, "LEGS"),
  entrainement(3, -10, "Pull A", 3, "PULL"),
  entrainement(4, -12, "Push B", 2, "PUSH"),
];
const jours_entrainement = [
  { date: "__DAY(-2)__", entraine: true, updated_at: ts },
  { date: "__DAY(-8)__", entraine: true, updated_at: ts },
  { date: "__DAY(-10)__", entraine: true, updated_at: ts },
  { date: "__DAY(-12)__", entraine: true, updated_at: ts },
];

// --- Agenda -------------------------------------------------------------------
const evenement = (n, titre, date, heure, heure_fin, extra = {}) => ({
  id: id("a40", n),
  titre,
  date,
  heure,
  heure_fin,
  toute_la_journee: false,
  notes: null,
  rappel_minutes: null,
  rappel_occurrence_envoyee: null,
  recurrence_fin: null,
  recurrence_frequence: null,
  created_at: ts,
  updated_at: ts,
  ...extra,
});
const evenements = [
  evenement(1, "Marché avec Léa", "__TODAY__", "10:15:00", "11:15:00"),
  evenement(2, "Déjeuner chez les grands-parents", "__TODAY__", "12:30:00", "14:30:00", { notes: "Apporter le dessert." }),
  evenement(3, "Appel visio avec le syndic au sujet du ravalement et du calendrier des travaux", "__TODAY__", "17:00:00", "17:45:00", { rappel_minutes: 15 }),
  evenement(4, "Cinéma : séance de 20 h 45", "__TODAY__", "20:45:00", "22:50:00"),
  evenement(5, "Week-end prolongé", "__TODAY__", "00:00:00", "23:59:00", { toute_la_journee: true }),
  evenement(6, "Cours de natation", "__DAY(-21)__", "07:30:00", "08:15:00", { recurrence_frequence: "hebdomadaire" }),
  evenement(7, "Rendez-vous ophtalmologue", "__DAY(2)__", "09:00:00", "09:30:00", { rappel_minutes: 60 }),
  evenement(8, "Anniversaire de Camille", "__DAY(4)__", "00:00:00", "23:59:00", { toute_la_journee: true }),
  evenement(9, "Révision de la chaudière", "__DAY(-3)__", "14:00:00", "15:00:00"),
];

// Horaires de travail fictifs, du lundi au vendredi (jour_semaine : 1 = lundi).
const horaires_travail_creneaux = [1, 2, 3, 4, 5].flatMap((jour, i) => [
  { id: 9100 + i * 2, jour_semaine: jour, heure_debut: "09:00:00", heure_fin: "12:30:00", frequence: "hebdomadaire", semaine_reference: null, updated_at: ts },
  { id: 9101 + i * 2, jour_semaine: jour, heure_debut: "14:00:00", heure_fin: "18:00:00", frequence: "hebdomadaire", semaine_reference: null, updated_at: ts },
]);

// --- Santé : derniers relevés vieux de plus de 7 jours (la pesée est due) -------
const mesures_corps = [
  { date: "__DAY(-9)__", poids_kg: 78.4, tour_taille_cm: 88.5, created_at: ts, updated_at: ts },
  { date: "__DAY(-16)__", poids_kg: 78.9, tour_taille_cm: 89, created_at: ts, updated_at: ts },
  { date: "__DAY(-23)__", poids_kg: 79.6, tour_taille_cm: null, created_at: ts, updated_at: ts },
  { date: "__DAY(-30)__", poids_kg: 80.1, tour_taille_cm: 90, created_at: ts, updated_at: ts },
  { date: "__DAY(-37)__", poids_kg: 80.3, tour_taille_cm: 90.5, created_at: ts, updated_at: ts },
];

// --- Jours fériés ---------------------------------------------------------------
// Le 1er janvier de l'année en cours sert de témoin d'import (sinon l'app
// interroge l'API Etalab, injoignable ici). Un férié fictif tombe aujourd'hui
// pour rendre la pastille « Jour férié » observable.
const annee = new Date().getFullYear();
const jours_feries = [
  { date: `${annee}-01-01`, nom: "1er janvier", created_at: ts },
  { date: `${annee}-05-01`, nom: "1er mai", created_at: ts },
  { date: `${annee}-11-11`, nom: "11 novembre", created_at: ts },
  { date: `${annee}-12-25`, nom: "Jour de Noël", created_at: ts },
  { date: `${annee + 1}-01-01`, nom: "1er janvier", created_at: ts },
  { date: "__TODAY__", nom: "Férié fictif d'audit", created_at: ts },
];

// Un jour libre déjà posé plus tôt dans la semaine (1 jeton utilisé sur 2).
const jours_libres = [{ date: "__DAY(-3)__", created_at: ts }];

export default {
  listes_taches: [
    { id: LISTE_MAISON, nom: "Maison", couleur: "#c2410c", ordre: 1, created_at: ts, updated_at: ts },
    { id: LISTE_ADMIN, nom: "Administratif", couleur: "#1d4ed8", ordre: 2, created_at: ts, updated_at: ts },
    { id: LISTE_TRAVAIL, nom: "Travail", couleur: "#7c3aed", ordre: 3, created_at: ts, updated_at: ts },
  ],
  tags: [
    { id: TAG_URGENT, nom: "urgent", couleur: "#dc2626", created_at: ts },
    { id: TAG_TELEPHONE, nom: "téléphone", couleur: null, created_at: ts },
    { id: TAG_WEEKEND, nom: "week-end", couleur: "#15803d", created_at: ts },
  ],
  taches,
  taches_tags: [
    { tache_id: id("a12", 1), tag_id: TAG_TELEPHONE },
    { tache_id: id("a12", 1), tag_id: TAG_URGENT },
    { tache_id: id("a12", 8), tag_id: TAG_URGENT },
    { tache_id: id("a12", 3), tag_id: TAG_WEEKEND },
  ],
  sous_taches: [
    { id: id("a13", 1), tache_id: id("a12", 2), titre: "Cuire le riz et le poulet", fait: true, termine_le: "__TODAY__T09:00:00+00:00", ordre: 0, created_at: ts },
    { id: id("a13", 2), tache_id: id("a12", 2), titre: "Couper les légumes", fait: false, termine_le: null, ordre: 1, created_at: ts },
    { id: id("a13", 3), tache_id: id("a12", 2), titre: "Répartir dans les boîtes", fait: false, termine_le: null, ordre: 2, created_at: ts },
  ],
  habitudes,
  habitude_entries,
  exercices,
  routines,
  routine_exercices,
  entrainements,
  jours_entrainement,
  evenements,
  horaires_travail_creneaux,
  mesures_corps,
  jours_feries,
  jours_libres,
};
