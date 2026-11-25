// Fixtures d'audit du module Tâches et Agenda (chargées avec MOCK_SUPABASE_AUDIT=1).
// Dates relatives : __DAY(n)__ = aujourd'hui + n jours (voir mock-supabase.mjs).
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ts = "2026-09-01T00:00:00+00:00";
const LISTE = "00000000-0000-4000-8000-000000000001"; // « Perso » (fixture de base)
const LISTE_TRAVAIL = uuid(9001);
const TAG_URGENT = uuid(9101);
const TAG_MAISON = uuid(9102);

const tache = (n, o) => ({
  id: uuid(9200 + n), titre: "", echeance: null, fait: false, heure: null, heure_fin: null,
  liste_id: LISTE, notes: null, ordre: n, priorite: "aucune", programme_jour: false,
  rappel_envoye_le: null, rappel_minutes: null, recurrence_fin: null, recurrence_frequence: null,
  termine_le: null, toute_la_journee: false, created_at: ts, updated_at: ts,
  liste: { id: LISTE, nom: "Perso", couleur: null }, sous_taches: [], taches_tags: [], tache_images: [], ...o,
});

export default {
  listes_taches: [
    { id: LISTE_TRAVAIL, nom: "Travail", couleur: "#4f7cff", ordre: 1, created_at: ts, updated_at: ts },
  ],
  tags: [
    { id: TAG_URGENT, nom: "urgent", couleur: "#e5484d", created_at: ts },
    { id: TAG_MAISON, nom: "maison", couleur: null, created_at: ts },
  ],
  taches: [
    tache(1, { titre: "Appeler le plombier", echeance: "__DAY(-2)__", priorite: "haute" }), // en retard
    tache(2, { titre: "Rendre le livre à la médiathèque", echeance: "__TODAY__", heure: "18:30:00", heure_fin: "19:00:00" }),
    tache(3, { titre: "Acheter du pain", echeance: "__TODAY__", toute_la_journee: true }),
    tache(4, { titre: "Préparer la réunion du lundi avec toute l'équipe produit et revoir le plan de lancement du trimestre prochain", echeance: "__DAY(1)__", liste_id: LISTE_TRAVAIL, liste: { id: LISTE_TRAVAIL, nom: "Travail", couleur: "#4f7cff" }, priorite: "moyenne" }),
    tache(5, { titre: "Arroser les plantes", echeance: "__TODAY__", recurrence_frequence: "quotidien", programme_jour: true }),
    tache(6, { titre: "Déclaration d'impôts", echeance: "__DAY(7)__", priorite: "haute", taches_tags: [{ tag: { id: TAG_URGENT, nom: "urgent", couleur: "#e5484d" } }] }),
    tache(7, { titre: "Ranger le garage", echeance: null, taches_tags: [{ tag: { id: TAG_MAISON, nom: "maison", couleur: null } }] }),
    tache(8, { titre: "Envoyer la facture", echeance: "__DAY(-1)__", fait: true, termine_le: "2026-09-01T10:00:00+00:00" }),
    tache(9, { titre: "Courses du week-end", echeance: "__DAY(2)__", sous_taches: [
      { id: uuid(9301), tache_id: uuid(9209), titre: "Lait", fait: true, ordre: 0, termine_le: ts, created_at: ts },
      { id: uuid(9302), tache_id: uuid(9209), titre: "Œufs", fait: false, ordre: 1, termine_le: null, created_at: ts },
    ] }),
    ...Array.from({ length: 16 }, (_, i) =>
      tache(20 + i, { titre: `Tâche de test n° ${i + 1}`, echeance: `__DAY(${i - 6})__`, liste_id: i % 3 === 0 ? LISTE_TRAVAIL : LISTE,
        liste: i % 3 === 0 ? { id: LISTE_TRAVAIL, nom: "Travail", couleur: "#4f7cff" } : { id: LISTE, nom: "Perso", couleur: null } })),
  ],
  sous_taches: [
    { id: uuid(9301), tache_id: uuid(9209), titre: "Lait", fait: true, ordre: 0, termine_le: ts, created_at: ts },
    { id: uuid(9302), tache_id: uuid(9209), titre: "Œufs", fait: false, ordre: 1, termine_le: null, created_at: ts },
  ],
  taches_tags: [
    { tache_id: uuid(9206), tag_id: TAG_URGENT },
    { tache_id: uuid(9207), tag_id: TAG_MAISON },
  ],
  evenements: [
    { id: uuid(9401), titre: "Déjeuner avec Camille", date: "__TODAY__", heure: "12:30:00", heure_fin: "14:00:00", notes: "Chez Léon", toute_la_journee: false, recurrence_frequence: null, recurrence_fin: null, rappel_minutes: 30, rappel_occurrence_envoyee: null, created_at: ts, updated_at: ts },
    { id: uuid(9402), titre: "Anniversaire de Léa", date: "__TODAY__", heure: "00:00:00", heure_fin: "23:59:00", notes: null, toute_la_journee: true, recurrence_frequence: null, recurrence_fin: null, rappel_minutes: null, rappel_occurrence_envoyee: null, created_at: ts, updated_at: ts },
    { id: uuid(9403), titre: "Point hebdo équipe", date: "__DAY(-14)__", heure: "10:00:00", heure_fin: "10:30:00", notes: null, toute_la_journee: false, recurrence_frequence: "hebdomadaire", recurrence_fin: null, rappel_minutes: 10, rappel_occurrence_envoyee: null, created_at: ts, updated_at: ts },
    { id: uuid(9404), titre: "Séjour à Lisbonne (titre volontairement très long pour tester le débordement)", date: "__DAY(3)__", heure: "00:00:00", heure_fin: "23:59:00", notes: null, toute_la_journee: true, recurrence_frequence: null, recurrence_fin: null, rappel_minutes: null, rappel_occurrence_envoyee: null, created_at: ts, updated_at: ts },
    { id: uuid(9405), titre: "Dentiste", date: "__DAY(1)__", heure: "08:15:00", heure_fin: "09:00:00", notes: null, toute_la_journee: false, recurrence_frequence: null, recurrence_fin: null, rappel_minutes: 60, rappel_occurrence_envoyee: null, created_at: ts, updated_at: ts },
    { id: uuid(9406), titre: "Chevauchement A", date: "__DAY(1)__", heure: "08:30:00", heure_fin: "09:30:00", notes: null, toute_la_journee: false, recurrence_frequence: null, recurrence_fin: null, rappel_minutes: null, rappel_occurrence_envoyee: null, created_at: ts, updated_at: ts },
  ],
  horaires_travail_creneaux: [
    ...[0, 1, 2, 3, 4].map((j) => ({ id: 9500 + j, frequence: "hebdomadaire", heure_debut: "09:00:00", heure_fin: "17:30:00", jour_semaine: j, semaine_reference: null, updated_at: ts })),
  ],
  horaires_travail_exceptions: [
    { id: 9600, date: "__DAY(2)__", heure_debut: "13:00:00", heure_fin: "20:00:00", updated_at: ts },
  ],
  jours_feries: [
    { date: "__DAY(5)__", nom: "Jour férié de test", created_at: ts },
  ],
};
