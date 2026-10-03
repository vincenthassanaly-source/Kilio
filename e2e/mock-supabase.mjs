// Faux Supabase (PostgREST) pour le rig instant() local — voir instant-nav.rig.md.
//
// Le sandbox cloud bloque l'accès sortant à Supabase : ce serveur répond à la
// place de https://vsmtkopkqasrdnjceegp.supabase.co pendant `next build` et
// `next start` (variable E2E_SUPABASE_URL lue par next.config.ts). Il ne sert
// qu'à rendre les pages avec des données plausibles et une latence réseau
// réaliste, pour que le streaming derrière les <Suspense> soit observable.
// Il applique les filtres PostgREST usuels (eq, gte, lt, in, or, order…) et
// les écritures (insert, upsert, update, delete), pour que le préchargement
// d'un jour ou d'un mois porte sur de vraies données et que les tests de
// mutation relisent l'état modifié.
//
// Usage : node e2e/mock-supabase.mjs  (port MOCK_SUPABASE_PORT, défaut 54321)

import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);
const LATENCY_MS = Number(process.env.MOCK_SUPABASE_LATENCY_MS ?? 400);

const fixtures = {
  // Même contenu que la ligne réelle (vérifié via Supabase MCP le 2026-09-24) :
  // barre du bas personnalisée, différente de DEFAULT_MODULES_BARRE_BASSE.
  preferences_navigation: [
    {
      id: 1,
      ordre_grille_plus: ["/", "/agenda", "/budget", "/taches", "/courses", "/collection", "/objectifs", "/notes", "/nutrition", "/habitudes", "/reglages"],
      modules_barre_basse: ["/", "/agenda", "/taches", "/notes"],
      updated_at: "2026-09-05T06:53:58.575119+00:00",
    },
  ],
  reglages_nettoyage: [
    {
      id: 1,
      actif: true,
      delai_jours: 30,
      derniere_execution: null,
      updated_at: "2026-09-11T00:00:00+00:00",
    },
  ],
  reglages_saisie_ia: [
    {
      id: 1,
      liste_taches_id: null,
      updated_at: "2026-10-02T00:00:00+00:00",
    },
  ],
};

// Module Pharmacie : un cours minimal (2 matières, 3 chapitres, 4 notions) et
// des cartes dont deux sont échues, pour rendre l'accueil, un chapitre et la
// révision avec des données plausibles.
fixtures.pharma_matieres = [
  { id: "00000000-0000-4000-8000-0000000000a1", nom: "Pharmacologie", ordre: 0, created_at: "2026-09-20T08:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000a2", nom: "Conseil officinal", ordre: 1, created_at: "2026-09-21T08:00:00+00:00" },
];
fixtures.pharma_chapitres = [
  { id: "00000000-0000-4000-8000-0000000000b1", matiere_id: "00000000-0000-4000-8000-0000000000a1", nom: "Antihypertenseurs", ordre: 0, created_at: "2026-09-20T08:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000b2", matiere_id: "00000000-0000-4000-8000-0000000000a1", nom: "Antibiotiques", ordre: 1, created_at: "2026-09-22T08:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000b3", matiere_id: "00000000-0000-4000-8000-0000000000a2", nom: "Douleur et fièvre", ordre: 0, created_at: "2026-09-21T08:00:00+00:00" },
];
fixtures.pharma_notions = [
  { id: "00000000-0000-4000-8000-0000000000c1", chapitre_id: "00000000-0000-4000-8000-0000000000b1", titre: "IEC : mécanisme", contenu: "Glycémie à jeun (adulte) :\n[bleu] Hypoglycémie : < 0,70 g/L\n[vert] Normale : 0,70 à 1,10 g/L\n[orange] Prédiabète : 1,10 à 1,25 g/L\n[rouge] Diabète : ≥ 1,26 g/L confirmée sur deux prélèvements", tags: ["iec", "hypertension"], ordre: 0, created_at: "2026-09-20T08:00:00+00:00", updated_at: "2026-09-20T08:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000c2", chapitre_id: "00000000-0000-4000-8000-0000000000b1", titre: "IEC : toux sèche", contenu: "Effet indésirable fréquent des IEC : une toux sèche, liée à l'accumulation de bradykinine.", tags: ["iec", "effet indésirable"], ordre: 1, created_at: "2026-09-20T09:00:00+00:00", updated_at: "2026-09-20T09:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000c3", chapitre_id: "00000000-0000-4000-8000-0000000000b2", titre: "Amoxicilline", contenu: "Antibiotique de la famille des pénicillines, actif sur de nombreuses bactéries à Gram positif.", tags: ["antibiotique", "pénicilline"], ordre: 0, created_at: "2026-09-22T08:00:00+00:00", updated_at: "2026-09-22T08:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000c4", chapitre_id: "00000000-0000-4000-8000-0000000000b3", titre: "Paracétamol : dose max", contenu: "Ne pas dépasser 3 g par jour chez l'adulte sans avis médical.", tags: ["paracétamol", "posologie"], ordre: 0, created_at: "2026-09-21T08:00:00+00:00", updated_at: "2026-09-21T08:00:00+00:00" },
];
fixtures.pharma_cartes = [
  { id: "00000000-0000-4000-8000-0000000000d1", notion_id: "00000000-0000-4000-8000-0000000000c1", question: "Quel est le mécanisme d'action des IEC ?", reponse: "[vert] Normale : 0,70 à 1,10 g/L\n[rouge] Diabète : ≥ 1,26 g/L", echeance: "2026-09-25T00:00:00+00:00", intervalle_jours: 3, facilite: 2.5, repetitions: 2, dernier_passage: "2026-09-22T00:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000d2", notion_id: "00000000-0000-4000-8000-0000000000c2", question: "Quel effet indésirable fréquent pour les IEC ?", reponse: "Une toux sèche (bradykinine).", echeance: "2026-09-26T00:00:00+00:00", intervalle_jours: 1, facilite: 2.5, repetitions: 1, dernier_passage: "2026-09-25T00:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000d3", notion_id: "00000000-0000-4000-8000-0000000000c3", question: "Amoxicilline : à quelle famille appartient-elle ?", reponse: "Les pénicillines.", echeance: "2030-01-01T00:00:00+00:00", intervalle_jours: 20, facilite: 2.6, repetitions: 4, dernier_passage: "2026-09-25T00:00:00+00:00" },
  { id: "00000000-0000-4000-8000-0000000000d4", notion_id: "00000000-0000-4000-8000-0000000000c4", question: "Dose maximale de paracétamol par jour chez l'adulte ?", reponse: "3 g sans avis médical.", echeance: "2030-01-01T00:00:00+00:00", intervalle_jours: 9, facilite: 2.5, repetitions: 3, dernier_passage: "2026-09-25T00:00:00+00:00" },
];

// Une tâche due aujourd'hui (date UTC, comme aujourdhuiISO côté serveur) pour
// vérifier que la cocher depuis le Dashboard met à jour /taches (parité des
// mutations optimistes TanStack Query, e2e/parite.spec.ts).
const LISTE_ID = "00000000-0000-4000-8000-000000000001";
fixtures.listes_taches = [
  { id: LISTE_ID, nom: "Perso", couleur: null, ordre: 0, created_at: "2026-09-01T00:00:00+00:00", updated_at: "2026-09-01T00:00:00+00:00" },
];
fixtures.taches = [
  {
    id: "00000000-0000-4000-8000-000000000002",
    titre: "Tâche e2e du jour",
    echeance: "__TODAY__",
    fait: false,
    heure: null,
    heure_fin: null,
    liste_id: LISTE_ID,
    notes: null,
    ordre: 0,
    priorite: "aucune",
    programme_jour: false,
    rappel_envoye_le: null,
    rappel_minutes: null,
    recurrence_fin: null,
    recurrence_frequence: null,
    termine_le: null,
    toute_la_journee: false,
    created_at: "2026-09-01T00:00:00+00:00",
    updated_at: "2026-09-01T00:00:00+00:00",
    liste: { id: LISTE_ID, nom: "Perso", couleur: null },
    sous_taches: [],
    taches_tags: [],
    tache_images: [],
  },
];

// ---------------------------------------------------------------------------
// Données réalistes pour le Journal, les Recettes et le Budget (préchargement
// de données : un préchargement de listes vides ne prouverait rien).
// Dates relatives au jour du test (UTC, comme todayISO()/aujourdhuiISO() côté
// serveur) : "__DAY(-1)__" = veille, "__MONTH(-2)__" = "YYYY-MM" il y a deux
// mois. Remplacées à chaque lecture par withToday().
// ---------------------------------------------------------------------------
const ts = "2026-09-01T00:00:00+00:00";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const ALIMENTS = {
  pain: { id: uuid(101), nom: "Pain de mie", unite: "piece", poids_unite_g: 25, kcal_100g: 265, proteines_100g: 8.5, glucides_100g: 49, lipides_100g: 3.5 },
  poulet: { id: uuid(102), nom: "Blanc de poulet", unite: "g", poids_unite_g: null, kcal_100g: 110, proteines_100g: 23, glucides_100g: 0, lipides_100g: 1.8 },
  riz: { id: uuid(103), nom: "Riz basmati cuit", unite: "g", poids_unite_g: null, kcal_100g: 130, proteines_100g: 2.7, glucides_100g: 28, lipides_100g: 0.3 },
  skyr: { id: uuid(104), nom: "Skyr nature", unite: "g", poids_unite_g: null, kcal_100g: 63, proteines_100g: 11, glucides_100g: 4, lipides_100g: 0.2 },
  lait: { id: uuid(105), nom: "Lait demi-écrémé", unite: "ml", poids_unite_g: null, kcal_100g: 46, proteines_100g: 3.2, glucides_100g: 4.8, lipides_100g: 1.6 },
};
fixtures.aliments = Object.values(ALIMENTS).map((a) => ({
  categorie: null, fibres_100g: null, sel_100g: null, sucres_100g: null, acides_gras_satures_100g: null, created_at: ts, updated_at: ts, ...a,
}));

const RECETTE_BOLO = uuid(201);
const RECETTE_HF = uuid(202);
const recetteBase = {
  description: null, temps_prepa_min: 30, ustensiles: null, source: "manuel", created_at: ts, updated_at: ts,
  kcal_100g: null, proteines_100g: null, glucides_100g: null, lipides_100g: null, fibres_100g: null, sucres_100g: null, satures_100g: null, sel_100g: null,
  kcal_portion: null, proteines_portion: null, glucides_portion: null, lipides_portion: null, fibres_portion: null, sucres_portion: null, satures_portion: null, sel_portion: null,
};
fixtures.recettes = [
  { ...recetteBase, id: RECETTE_BOLO, nom: "Poulet riz meal prep", portions: 4 },
  {
    ...recetteBase, id: RECETTE_HF, nom: "Curry de légumes HelloFresh", portions: 2, source: "hellofresh", temps_prepa_min: 25,
    ustensiles: ["Poêle", "Casserole"], kcal_portion: 640, proteines_portion: 18, glucides_portion: 82, lipides_portion: 24,
  },
];
fixtures.recette_ingredients = [
  { id: uuid(301), recette_id: RECETTE_BOLO, aliment_id: ALIMENTS.poulet.id, quantite: 600, unite: "g" },
  { id: uuid(302), recette_id: RECETTE_BOLO, aliment_id: ALIMENTS.riz.id, quantite: 800, unite: "g" },
];
fixtures.recette_ingredients_libres = [
  { id: uuid(311), recette_id: RECETTE_HF, nom: "Lait de coco", quantite: "200 ml", ordre: 0, created_at: ts },
  { id: uuid(312), recette_id: RECETTE_HF, nom: "Pâte de curry", quantite: "1 sachet", ordre: 1, created_at: ts },
];
fixtures.recette_etapes = [
  { id: uuid(321), recette_id: RECETTE_HF, ordre: 0, titre: "Préparer", consigne: "Émincer les légumes.", astuce: null, created_at: ts, updated_at: ts },
  { id: uuid(322), recette_id: RECETTE_HF, ordre: 1, titre: "Cuire", consigne: "Faire revenir puis ajouter le lait de coco.", astuce: null, created_at: ts, updated_at: ts },
];

fixtures.objectifs_nutritionnels = [
  { id: uuid(401), jour_type: "repos", kcal_cible: 2100, proteines_cible_g: 130, glucides_cible_g: 220, lipides_cible_g: 70, created_at: ts, updated_at: ts },
  { id: uuid(402), jour_type: "entrainement", kcal_cible: 2500, proteines_cible_g: 150, glucides_cible_g: 290, lipides_cible_g: 75, created_at: ts, updated_at: ts },
];

const repas = (n, date, moment, alimentOuRecette, quantite) => ({
  id: uuid(500 + n), date, moment, quantite, created_at: ts,
  aliment_id: alimentOuRecette.startsWith("R") ? null : ALIMENTS[alimentOuRecette].id,
  recette_id: alimentOuRecette === "R-bolo" ? RECETTE_BOLO : alimentOuRecette === "R-hf" ? RECETTE_HF : null,
});
fixtures.journal_repas = [
  repas(1, "__TODAY__", "petit_dej", "pain", 50),
  repas(2, "__TODAY__", "petit_dej", "skyr", 150),
  repas(3, "__TODAY__", "dejeuner", "R-bolo", 1),
  repas(4, "__DAY(-1)__", "petit_dej", "lait", 250),
  repas(5, "__DAY(-1)__", "dejeuner", "poulet", 180),
  repas(6, "__DAY(-1)__", "diner", "R-hf", 1),
  repas(7, "__DAY(-2)__", "dejeuner", "riz", 200),
  repas(8, "__DAY(1)__", "collation", "skyr", 125),
];

// Budget : deux comptes, catégories, budgets du mois courant, transactions
// sur les trois derniers mois, une récurrence future (aucune génération
// pendant les tests, sauf mutation explicite).
const COMPTE_COURANT = uuid(601);
const COMPTE_LIVRET = uuid(602);
fixtures.comptes = [
  { id: COMPTE_COURANT, nom: "Compte courant", type: "courant", solde_initial: 1200, created_at: "2026-01-01T00:00:00+00:00", updated_at: ts },
  { id: COMPTE_LIVRET, nom: "Livret A", type: "epargne", solde_initial: 5000, created_at: "2026-01-02T00:00:00+00:00", updated_at: ts },
];
const CAT = { alim: uuid(701), logement: uuid(702), loisirs: uuid(703), salaire: uuid(704) };
fixtures.categories_budget = [
  { id: CAT.alim, nom: "Alimentation", type: "depense", icone: "🛒", categorie_parent_id: null, is_predefinie: true, created_at: ts, updated_at: ts },
  { id: CAT.logement, nom: "Logement", type: "depense", icone: "🏠", categorie_parent_id: null, is_predefinie: true, created_at: ts, updated_at: ts },
  { id: CAT.loisirs, nom: "Loisirs", type: "depense", icone: "🎬", categorie_parent_id: null, is_predefinie: false, created_at: ts, updated_at: ts },
  { id: CAT.salaire, nom: "Salaire", type: "revenu", icone: "💶", categorie_parent_id: null, is_predefinie: true, created_at: ts, updated_at: ts },
];
fixtures.budgets = [
  { id: uuid(801), categorie_id: CAT.alim, montant_cible: 300, periode: "__MONTH(0)__-01", type_periode: "mensuel", created_at: ts, updated_at: ts },
  { id: uuid(802), categorie_id: CAT.loisirs, montant_cible: 50, periode: "__MONTH(0)__-01", type_periode: "mensuel", created_at: ts, updated_at: ts },
];
let tx = 900;
const transaction = (mois, jour, type, montant, categorie, libelle) => ({
  id: uuid(++tx), compte_id: COMPTE_COURANT, compte_destination_id: null, categorie_id: categorie, type, montant, libelle,
  date_operation: `__MONTH(${mois})__-${jour}`, transaction_recurrente_id: null, created_at: ts, updated_at: ts,
});
fixtures.transactions = [
  transaction(0, "01", "revenu", 2400, CAT.salaire, "Salaire"),
  transaction(0, "01", "depense", 750, CAT.logement, "Loyer"),
  transaction(0, "01", "depense", 62.4, CAT.alim, "Courses marché"),
  transaction(0, "01", "depense", 58, CAT.loisirs, "Cinéma et resto"),
  transaction(-1, "01", "revenu", 2400, CAT.salaire, "Salaire"),
  transaction(-1, "01", "depense", 750, CAT.logement, "Loyer"),
  transaction(-1, "12", "depense", 184.3, CAT.alim, "Supermarché"),
  transaction(-1, "20", "depense", 32, CAT.loisirs, "Concert"),
  transaction(-2, "01", "revenu", 2350, CAT.salaire, "Salaire"),
  transaction(-2, "01", "depense", 750, CAT.logement, "Loyer"),
  transaction(-2, "15", "depense", 211.9, CAT.alim, "Supermarché"),
  { ...transaction(-1, "05", "virement", 200, null, "Épargne"), compte_destination_id: COMPTE_LIVRET },
];
fixtures.transactions_recurrentes = [
  {
    id: uuid(1001), compte_id: COMPTE_COURANT, compte_destination_id: null, categorie_id: CAT.logement, type: "depense", montant: 750,
    libelle: "Loyer", frequence: "mensuel", active: true, date_debut: "2026-01-01", date_fin: null,
    prochaine_occurrence: "__MONTH(1)__-01", created_at: ts, updated_at: ts,
  },
];

// Module Sport : bibliothèque réduite à trois exercices et une routine « Push »
// (deux exercices) ; aucune séance enregistrée au départ.
const SPORT_BANC = "Barbell_Bench_Press_-_Medium_Grip";
const SPORT_SQUAT = "Barbell_Squat";
const SPORT_PLANCHE = "Plank";
const sportExercice = (id, nom_fr, nom_en, muscle_principal, type_mesure, instructions) => ({
  id, nom_fr, nom_en, muscle_principal, muscles_secondaires: [], equipement: "barbell", categorie: "strength",
  niveau: "beginner", mecanique: "compound", type_mesure, instructions_fr: instructions,
  images: [`${id}/0.webp`, `${id}/1.webp`], created_at: ts,
});
fixtures.sport_exercices = [
  sportExercice(SPORT_BANC, "Développé couché à la barre, prise moyenne", "Barbell Bench Press - Medium Grip", "chest", "poids_reps", ["Allonge-toi sur un banc plat.", "Descends la barre vers la poitrine puis repousse."]),
  sportExercice(SPORT_SQUAT, "Squat à la barre", "Barbell Squat", "quadriceps", "poids_reps", ["Place la barre sur les trapèzes.", "Descends en fléchissant les genoux puis remonte."]),
  sportExercice(SPORT_PLANCHE, "Gainage planche", "Plank", "abdominals", "duree", ["Appuie-toi sur les avant-bras et garde le corps aligné."]),
];
// Le développé couché a une illustration dessinée (poses réelles extraites de ses
// photos) ; le squat n'en a pas : l'app retombe sur ses photos.
fixtures.sport_exercices[0].poses = {"v":1,"a":[[122.7,86.2],[128.4,84.4],[94.1,86.0],[167.3,77.5],[88.3,69.8],[180.0,48.9],[95.0,40.7],[109.7,94.1],[89.7,90.7],[90.4,140.6],[33.6,119.9],[101.1,197.0],[35.2,164.0],[89.0,219.3],[33.3,180.6]],"b":[[78.5,114.7],[93.7,99.7],[68.6,92.2],[97.0,102.4],[73.5,91.9],[96.7,99.4],[88.0,88.7],[90.2,112.1],[74.3,106.9],[87.1,144.4],[35.5,128.3],[98.1,194.6],[38.2,166.4],[88.2,212.0],[20.0,177.1]]};
fixtures.sport_routines = [{ id: uuid(2001), nom: "Push", ordre: 0, created_at: ts }];
fixtures.sport_routine_exercices = [
  { id: uuid(2101), routine_id: uuid(2001), exercice_id: SPORT_BANC, position: 0, nb_series: 3, reps_cible: 8, repos_s: 90 },
  { id: uuid(2102), routine_id: uuid(2001), exercice_id: SPORT_SQUAT, position: 1, nb_series: 2, reps_cible: 10, repos_s: 60 },
];
fixtures.sport_seances = [];
fixtures.sport_series = [];

// Embeds PostgREST (`alias:table(...)`) : reconstitués à la lecture à partir
// des clés étrangères, uniquement si la requête les demande dans `select`.
const pick = (table, id) => (id ? fixtures[table]?.find((r) => r.id === id) ?? null : null);
const RELATIONS = {
  journal_repas: {
    aliment: (r) => pick("aliments", r.aliment_id),
    recette: (r) => {
      const recette = pick("recettes", r.recette_id);
      return recette && { ...recette, recette_ingredients: ingredientsDe(recette.id) };
    },
  },
  recettes: {
    recette_ingredients: (r) => ingredientsDe(r.id),
    recette_ingredients_libres: (r) => (fixtures.recette_ingredients_libres ?? []).filter((i) => i.recette_id === r.id),
  },
  recette_ingredients: { aliment: (r) => pick("aliments", r.aliment_id) },
  sport_routines: {
    sport_routine_exercices: (r) =>
      (fixtures.sport_routine_exercices ?? [])
        .filter((ligne) => ligne.routine_id === r.id)
        .map((ligne) => ({ ...ligne, exercice: pick("sport_exercices", ligne.exercice_id) })),
  },
  sport_routine_exercices: { exercice: (r) => pick("sport_exercices", r.exercice_id) },
  transactions: {
    compte: (r) => pick("comptes", r.compte_id),
    compte_destination: (r) => pick("comptes", r.compte_destination_id),
    categorie: (r) => pick("categories_budget", r.categorie_id),
  },
  transactions_recurrentes: {
    compte: (r) => pick("comptes", r.compte_id),
    compte_destination: (r) => pick("comptes", r.compte_destination_id),
    categorie: (r) => pick("categories_budget", r.categorie_id),
  },
};
function ingredientsDe(recetteId) {
  return (fixtures.recette_ingredients ?? [])
    .filter((i) => i.recette_id === recetteId)
    .map((i) => ({ ...i, aliment: pick("aliments", i.aliment_id) }));
}
function withRelations(table, rows, select) {
  const relations = RELATIONS[table];
  if (!relations || !select) return rows;
  const wanted = Object.keys(relations).filter((key) => new RegExp(`(^|[,(])${key}[:(!]`).test(select));
  if (wanted.length === 0) return rows;
  return rows.map((row) => {
    const out = { ...row };
    for (const key of wanted) out[key] = relations[key](row);
    return out;
  });
}

const initialFixtures = JSON.parse(JSON.stringify(fixtures));

function isoDay(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
function isoMonth(offset) {
  const d = new Date();
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  return m.toISOString().slice(0, 7);
}
function withToday(rows) {
  const json = JSON.stringify(rows)
    .replaceAll('"__TODAY__"', JSON.stringify(isoDay(0)))
    .replace(/__DAY\((-?\d+)\)__/g, (_, n) => isoDay(Number(n)))
    .replace(/__MONTH\((-?\d+)\)__/g, (_, n) => isoMonth(Number(n)));
  return JSON.parse(json);
}
// Les fixtures sont stockées avec leurs jetons de date ; toute écriture les
// fige d'abord pour que les filtres portent sur de vraies dates.
function materialize(table) {
  if (fixtures[table]) fixtures[table] = withToday(fixtures[table]);
  return fixtures[table] ?? (fixtures[table] = []);
}

// Filtres PostgREST utilisés par l'app : eq, neq, gt, gte, lt, lte, in, is,
// ilike, like, or=(…) ; tri `order=col.asc|desc,…` ; `limit`.
function parseValue(raw) {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}
function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  const na = Number(a);
  const nb = Number(b);
  if (typeof a === "number" || (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== "" && !/^\d{4}-\d{2}/.test(String(a)))) return na - nb;
  return String(a) < String(b) ? -1 : 1;
}
function matchOne(row, column, expr) {
  const negate = expr.startsWith("not.");
  if (negate) expr = expr.slice(4);
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const raw = expr.slice(dot + 1);
  const v = row[column];
  let ok;
  switch (op) {
    case "eq": ok = v !== null && v !== undefined && String(v) === raw; break;
    case "neq": ok = String(v) !== raw; break;
    case "gt": ok = v !== null && compare(v, raw) > 0; break;
    case "gte": ok = v !== null && compare(v, raw) >= 0; break;
    case "lt": ok = v !== null && compare(v, raw) < 0; break;
    case "lte": ok = v !== null && compare(v, raw) <= 0; break;
    case "is": ok = v === parseValue(raw) || (raw === "null" && v === undefined); break;
    case "in": {
      const list = raw.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
      ok = list.includes(String(v));
      break;
    }
    case "like":
    case "ilike": {
      if (v === null || v === undefined) { ok = false; break; }
      const re = new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*")}$`, op === "ilike" ? "i" : "");
      ok = re.test(String(v));
      break;
    }
    default: ok = true;
  }
  return negate ? !ok : ok;
}
function matchOr(row, raw) {
  const inner = raw.replace(/^\(|\)$/g, "");
  return inner.split(",").some((part) => {
    const dot = part.indexOf(".");
    return matchOne(row, part.slice(0, dot), part.slice(dot + 1));
  });
}
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
function applyFilters(rows, params) {
  let out = rows;
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue;
    if (key === "or") out = out.filter((row) => matchOr(row, value));
    else out = out.filter((row) => matchOne(row, key, value));
  }
  return out;
}
function applyOrder(rows, params) {
  const order = params.get("order");
  if (!order) return rows;
  const keys = order.split(",").map((k) => {
    const [col, dir = "asc"] = k.split(".");
    return { col, desc: dir === "desc" };
  });
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      const c = compare(a[col], b[col]);
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
}

function send(res, status, body, headers = {}) {
  setTimeout(() => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  }, LATENCY_MS);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

// Journal des écritures reçues (tests de mutation) : GET /__writes.
const writes = [];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Remise à zéro des fixtures entre deux tests de mutation.
  if (url.pathname === "/__reset") {
    for (const key of Object.keys(fixtures)) delete fixtures[key];
    Object.assign(fixtures, JSON.parse(JSON.stringify(initialFixtures)));
    writes.length = 0;
    res.writeHead(204).end();
    return;
  }
  if (url.pathname === "/__writes") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(writes));
    return;
  }

  const match = url.pathname.match(/^\/rest\/v1\/(rpc\/)?([^/]+)$/);
  if (!match) {
    send(res, 404, { message: "not mocked" });
    return;
  }
  const [, isRpc, table] = match;
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  const body = req.method === "GET" || req.method === "HEAD" ? null : await readBody(req);
  const params = url.searchParams;

  if (isRpc) {
    send(res, 200, []);
    return;
  }

  let result;
  if (req.method === "GET" || req.method === "HEAD") {
    const rows = applyOrder(applyFilters(withToday(fixtures[table] ?? []), params), params);
    const limit = Number(params.get("limit") ?? NaN);
    result = withRelations(table, Number.isFinite(limit) ? rows.slice(0, limit) : rows, params.get("select"));
  } else {
    writes.push({ method: req.method, table, query: url.search, body });
    const rows = materialize(table);
    if (req.method === "PATCH") {
      const targets = new Set(applyFilters(rows, params));
      fixtures[table] = rows.map((row) => (targets.has(row) ? { ...row, ...body } : row));
      result = fixtures[table].filter((row, i) => targets.has(rows[i]));
    } else if (req.method === "DELETE") {
      const targets = new Set(applyFilters(rows, params));
      fixtures[table] = rows.filter((row) => !targets.has(row));
      result = [...targets];
    } else {
      // POST : insert ou upsert (on_conflict).
      const inserted = (Array.isArray(body) ? body : body ? [body] : []).map((row) => ({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...row,
      }));
      // Un upsert sans `on_conflict` (supabase-js : clé primaire implicite)
      // fusionne sur `id` quand la ligne en fournit un.
      const conflict =
        params.get("on_conflict")?.split(",") ?? (/merge-duplicates/.test(req.headers.prefer ?? "") ? ["id"] : undefined);
      result = [];
      for (const row of inserted) {
        const existing = conflict ? rows.findIndex((r) => conflict.every((c) => String(r[c]) === String(row[c]))) : -1;
        if (existing >= 0) {
          rows[existing] = { ...rows[existing], ...row, id: rows[existing].id };
          result.push(rows[existing]);
        } else {
          rows.push(row);
          result.push(row);
        }
      }
    }
    result = withRelations(table, result, params.get("select"));
  }

  if (wantsObject) {
    if (result.length !== 1) {
      send(res, 406, { code: "PGRST116", details: `${result.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" });
      return;
    }
    send(res, 200, result[0]);
    return;
  }

  send(res, 200, result, { "content-range": `0-${Math.max(result.length - 1, 0)}/${result.length}` });
});

server.listen(PORT, () => {
  console.log(`mock-supabase listening on http://localhost:${PORT} (latency ${LATENCY_MS}ms)`);
});
