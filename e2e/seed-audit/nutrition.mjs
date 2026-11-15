// Seed d'audit du module Nutrition : données FICTIVES (aucune donnée réelle).
// Complète les fixtures de e2e/mock-supabase.mjs (5 aliments, 2 recettes, 8 repas,
// 2 objectifs) : aliments, recettes avec ingrédients et étapes, une semaine de
// repas, menus de la semaine en cours (mangés / à manger), pesées, un jour libre.

const ts = "2026-10-01T07:00:00+00:00";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Aliments du mock (ids 101 à 105) réutilisés par les repas ci-dessous.
const PAIN = uuid(101);
const POULET = uuid(102);
const RIZ = uuid(103);
const SKYR = uuid(104);
const LAIT = uuid(105);

const aliment = (n, nom, unite, poids_unite_g, kcal, p, g, l, categorie = null) => ({
  id: uuid(n), nom, unite, poids_unite_g, kcal_100g: kcal, proteines_100g: p, glucides_100g: g, lipides_100g: l,
  categorie, fibres_100g: null, sel_100g: null, sucres_100g: null, acides_gras_satures_100g: null, created_at: ts, updated_at: ts,
});
const A = {
  oeuf: aliment(111, "Œuf entier", "piece", 55, 145, 12.5, 0.7, 10.5),
  avoine: aliment(112, "Flocons d'avoine complets", "g", null, 370, 13.5, 59, 7),
  banane: aliment(113, "Banane", "piece", 120, 90, 1.1, 20, 0.3),
  saumon: aliment(114, "Pavé de saumon atlantique sans peau, surgelé", "g", null, 200, 20, 0, 13),
  brocoli: aliment(115, "Brocoli cuit vapeur", "g", null, 30, 2.8, 3, 0.4),
  pates: aliment(116, "Pâtes complètes cuites", "g", null, 125, 5, 24, 1),
  huile: aliment(117, "Huile d'olive vierge extra", "ml", null, 824, 0, 0, 91.6),
  amandes: aliment(118, "Amandes entières non salées", "g", null, 620, 21, 9, 53),
  boeuf: aliment(119, "Steak haché de bœuf 5 % MG", "piece", 125, 130, 21, 0, 5),
  tomate: aliment(120, "Coulis de tomate nature", "g", null, 32, 1.4, 5, 0.3),
  lentilles: aliment(121, "Lentilles corail cuites", "g", null, 115, 9, 17, 0.5),
  fromage: aliment(122, "Fromage blanc 0 %", "g", null, 48, 8, 4, 0.1),
};

const recetteBase = {
  description: null, temps_prepa_min: 30, ustensiles: null, source: "manuel", created_at: ts, updated_at: ts,
  kcal_100g: null, proteines_100g: null, glucides_100g: null, lipides_100g: null, fibres_100g: null, sucres_100g: null, satures_100g: null, sel_100g: null,
  kcal_portion: null, proteines_portion: null, glucides_portion: null, lipides_portion: null, fibres_portion: null, sucres_portion: null, satures_portion: null, sel_portion: null,
};
const R = {
  porridge: uuid(211),
  saumon: uuid(212),
  bolo: uuid(213),
  dahl: uuid(214),
  omelette: uuid(215),
  bowl: uuid(216),
};
const recettes = [
  { ...recetteBase, id: R.porridge, nom: "Porridge banane et amandes", portions: 1, temps_prepa_min: 10, description: "Petit-déjeuner des jours d'entraînement." },
  { ...recetteBase, id: R.saumon, nom: "Saumon rôti, brocoli vapeur et riz basmati", portions: 2, temps_prepa_min: 25, ustensiles: ["Four", "Cuit-vapeur"] },
  { ...recetteBase, id: R.bolo, nom: "Pâtes complètes à la bolognaise maison (version allégée du dimanche soir)", portions: 4, temps_prepa_min: 45, ustensiles: ["Sauteuse", "Casserole"], description: "Se congèle très bien en portions individuelles." },
  {
    ...recetteBase, id: R.dahl, nom: "Dahl de lentilles corail HelloFresh", portions: 2, temps_prepa_min: 35, source: "hellofresh",
    ustensiles: ["Casserole"], kcal_portion: 590, proteines_portion: 27, glucides_portion: 78, lipides_portion: 17,
  },
  { ...recetteBase, id: R.omelette, nom: "Omelette aux trois œufs", portions: 1, temps_prepa_min: 8 },
  { ...recetteBase, id: R.bowl, nom: "Bowl skyr, avoine et banane", portions: 1, temps_prepa_min: 5 },
];

let nIng = 330;
const ing = (recette_id, a, quantite, unite) => ({ id: uuid(++nIng), recette_id, aliment_id: a, quantite, unite });
const recette_ingredients = [
  ing(R.porridge, A.avoine.id, 60, "g"), ing(R.porridge, LAIT, 250, "ml"), ing(R.porridge, A.banane.id, 1, "piece"), ing(R.porridge, A.amandes.id, 15, "g"),
  ing(R.saumon, A.saumon.id, 300, "g"), ing(R.saumon, A.brocoli.id, 400, "g"), ing(R.saumon, RIZ, 300, "g"), ing(R.saumon, A.huile.id, 10, "ml"),
  ing(R.bolo, A.pates.id, 800, "g"), ing(R.bolo, A.boeuf.id, 4, "piece"), ing(R.bolo, A.tomate.id, 500, "g"), ing(R.bolo, A.huile.id, 15, "ml"),
  ing(R.omelette, A.oeuf.id, 3, "piece"), ing(R.omelette, A.huile.id, 5, "ml"),
  ing(R.bowl, SKYR, 200, "g"), ing(R.bowl, A.avoine.id, 40, "g"), ing(R.bowl, A.banane.id, 1, "piece"),
];

let nLibre = 350;
const libre = (recette_id, nom, quantite, ordre) => ({ id: uuid(++nLibre), recette_id, nom, quantite, ordre, created_at: ts });
const recette_ingredients_libres = [
  libre(R.dahl, "Lentilles corail", "150 g", 0), libre(R.dahl, "Lait de coco", "200 ml", 1), libre(R.dahl, "Pâte de curry jaune", "1 sachet", 2),
  libre(R.dahl, "Oignon jaune", "1", 3), libre(R.dahl, "Épinards frais", "100 g", 4),
  libre(R.bolo, "Oignon jaune", "1", 0), libre(R.bolo, "Herbes de Provence", "1 c. à café", 1),
  libre(R.saumon, "Citron", "1", 0),
];

let nEtape = 370;
const etape = (recette_id, ordre, titre, consigne, astuce = null) => ({ id: uuid(++nEtape), recette_id, ordre, titre, consigne, astuce, created_at: ts, updated_at: ts });
const recette_etapes = [
  etape(R.porridge, 0, "Chauffer", "Porter le lait à frémissement puis verser les flocons d'avoine."),
  etape(R.porridge, 1, "Garnir", "Ajouter la banane en rondelles et les amandes concassées.", "Une pincée de cannelle relève le tout."),
  etape(R.saumon, 0, "Préchauffer", "Four à 200 °C, chaleur tournante."),
  etape(R.saumon, 1, "Rôtir le saumon", "Badigeonner d'huile d'olive, saler, enfourner 12 minutes."),
  etape(R.saumon, 2, "Cuire les accompagnements", "Brocoli 8 minutes à la vapeur, riz selon le paquet."),
  etape(R.saumon, 3, "Dresser", "Répartir dans deux assiettes, presser le citron."),
  etape(R.bolo, 0, "Faire revenir", "Émincer l'oignon et le faire suer dans l'huile d'olive, puis ajouter la viande émiettée et la laisser colorer à feu vif sans la remuer pendant deux minutes."),
  etape(R.bolo, 1, "Mijoter", "Verser le coulis, les herbes, couvrir et laisser mijoter 25 minutes.", "Un peu d'eau de cuisson des pâtes lie la sauce."),
  etape(R.bolo, 2, "Cuire les pâtes", "Al dente, dans une grande casserole d'eau salée."),
  etape(R.dahl, 0, "Rincer", "Rincer les lentilles à l'eau froide."),
  etape(R.dahl, 1, "Cuire", "Faire revenir l'oignon et la pâte de curry, ajouter lentilles, lait de coco et 300 ml d'eau. 20 minutes."),
  etape(R.dahl, 2, "Finir", "Ajouter les épinards hors du feu."),
  etape(R.omelette, 0, "Battre et cuire", "Battre les œufs, cuire 3 minutes à feu moyen."),
];

// Carnet : une semaine de repas (le mock fournit déjà aujourd'hui, J-1, J-2, J+1).
let nRepas = 520;
const repas = (jour, moment, cible, quantite, extra = {}) => ({
  id: uuid(++nRepas), date: jour === 0 ? "__TODAY__" : `__DAY(${jour})__`, moment, quantite,
  created_at: `__DAY(${jour})__T${moment === "petit_dej" ? "07" : moment === "dejeuner" ? "12" : moment === "collation" ? "16" : "19"}:30:00+00:00`,
  aliment_id: cible.aliment ?? null, recette_id: cible.recette ?? null, ...extra,
});
const al = (id) => ({ aliment: id });
const re = (id) => ({ recette: id });
const journal_repas = [
  repas(0, "collation", al(A.amandes.id), 30),
  repas(-1, "collation", al(A.banane.id), 1),
  repas(-2, "petit_dej", re(R.porridge), 1), repas(-2, "collation", al(A.fromage.id), 200), repas(-2, "diner", re(R.saumon), 1),
  repas(-3, "petit_dej", re(R.bowl), 1), repas(-3, "dejeuner", re(R.bolo), 1.5), repas(-3, "collation", al(A.amandes.id), 40), repas(-3, "diner", re(R.omelette), 1), repas(-3, "diner", al(PAIN), 4),
  repas(-4, "petit_dej", al(A.avoine.id), 70), repas(-4, "petit_dej", al(LAIT), 300), repas(-4, "dejeuner", al(POULET), 200), repas(-4, "dejeuner", al(RIZ), 250), repas(-4, "dejeuner", al(A.brocoli.id), 200), repas(-4, "diner", re(R.dahl), 1),
  repas(-5, "petit_dej", re(R.porridge), 1), repas(-5, "dejeuner", re(R.saumon), 1), repas(-5, "collation", al(SKYR), 150), repas(-5, "diner", re(R.bolo), 2), repas(-5, "diner", al(A.amandes.id), 60),
  repas(-6, "petit_dej", al(A.oeuf.id), 2), repas(-6, "petit_dej", al(PAIN), 2), repas(-6, "dejeuner", re(R.dahl), 1), repas(-6, "diner", al(A.boeuf.id), 1), repas(-6, "diner", al(A.pates.id), 220),
  repas(-8, "dejeuner", re(R.bolo), 1), repas(-8, "diner", re(R.omelette), 1),
  repas(-9, "petit_dej", re(R.bowl), 1), repas(-9, "dejeuner", al(POULET), 220), repas(-9, "diner", re(R.saumon), 1),
  repas(-12, "dejeuner", re(R.dahl), 1), repas(-12, "diner", al(A.saumon.id), 150),
];

// Menus : semaine en cours (aujourd'hui = J0) et semaine précédente.
let nMenu = 600;
const menu = (jour, moment, cible, quantite, mange = false, journal_repas_id = null) => ({
  id: uuid(++nMenu), date: jour === 0 ? "__TODAY__" : `__DAY(${jour})__`, moment, quantite, mange, journal_repas_id,
  aliment_id: cible.aliment ?? null, recette_id: cible.recette ?? null, created_at: `2026-10-0${1 + (nMenu % 8)}T08:00:00+00:00`,
});
const menus_repas = [
  menu(-2, "petit_dej", re(R.porridge), 1, true), menu(-2, "diner", re(R.saumon), 1, true),
  menu(-1, "dejeuner", al(POULET), 180, true), menu(-1, "diner", re(R.bolo), 1),
  menu(0, "petit_dej", re(R.bowl), 1), menu(0, "dejeuner", re(R.saumon), 1), menu(0, "collation", al(A.amandes.id), 30), menu(0, "diner", re(R.dahl), 1),
  menu(1, "petit_dej", re(R.porridge), 1), menu(1, "dejeuner", re(R.bolo), 1), menu(1, "diner", re(R.omelette), 1), menu(1, "diner", al(A.brocoli.id), 200),
  menu(2, "dejeuner", re(R.dahl), 1), menu(2, "diner", al(A.boeuf.id), 2),
  menu(3, "dejeuner", re(R.saumon), 1),
  menu(-7, "dejeuner", re(R.bolo), 1, true), menu(-7, "diner", re(R.omelette), 1, true),
  menu(-8, "petit_dej", re(R.bowl), 1, true), menu(-9, "diner", re(R.saumon), 1, true), menu(-10, "dejeuner", re(R.dahl), 1),
];

const mesure = (jour, poids_kg, tour_taille_cm) => ({ date: `__DAY(${jour})__`, poids_kg, tour_taille_cm, created_at: ts, updated_at: ts });

export default {
  aliments: Object.values(A),
  recettes,
  recette_ingredients,
  recette_ingredients_libres,
  recette_etapes,
  journal_repas,
  menus_repas,
  mesures_corps: [mesure(-41, 84.6, 96), mesure(-34, 84.1, 95.5), mesure(-27, 83.8, 95), mesure(-20, 83.9, 94.5), mesure(-13, 83.2, 94), mesure(-6, 82.7, null)],
  jours_libres: [{ date: "__DAY(-4)__", created_at: ts }],
  jours_entrainement: [
    { date: "__DAY(-5)__", entraine: true, updated_at: ts },
    { date: "__DAY(-3)__", entraine: true, updated_at: ts },
    { date: "__DAY(-1)__", entraine: true, updated_at: ts },
    { date: "__DAY(-8)__", entraine: true, updated_at: ts },
  ],
};

const pick = (fixtures, table, id) => (id ? (fixtures[table] ?? []).find((r) => r.id === id) ?? null : null);
const recetteComplete = (fixtures, id) => {
  const recette = pick(fixtures, "recettes", id);
  return (
    recette && {
      ...recette,
      recette_ingredients: (fixtures.recette_ingredients ?? [])
        .filter((i) => i.recette_id === id)
        .map((i) => ({ ...i, aliment: pick(fixtures, "aliments", i.aliment_id) })),
      recette_ingredients_libres: (fixtures.recette_ingredients_libres ?? []).filter((i) => i.recette_id === id),
    }
  );
};

// Embeds demandés par les Menus (MenusSemaine, envoyerMenuAuxCourses).
export const relations = {
  menus_repas: {
    aliment: (ligne, fixtures) => pick(fixtures, "aliments", ligne.aliment_id),
    recette: (ligne, fixtures) => recetteComplete(fixtures, ligne.recette_id),
  },
};
