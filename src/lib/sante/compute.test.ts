import { describe, expect, it } from "vitest";
import { nutritionEntree, type EntreeJournal, type JourBilan } from "@/lib/nutrition/bilan";
import {
  bilanDu,
  composerBilanHebdo,
  kcalParJour,
  semaineDe,
  type EntreeKcal,
  type JourKcal,
} from "../../../supabase/functions/envoyer-bilan-hebdo/compose";
import {
  evolutionPoids,
  evolutionTaille,
  formaterDelta,
  joursKcalDepuisBilan,
  nombreFr,
  poidsLisse,
  syntheseKcal,
  syntheseSeances,
  type Mesure,
} from "./compute";

const mesure = (date: string, poids_kg: number | null, tour_taille_cm: number | null = null): Mesure => ({
  date,
  poids_kg,
  tour_taille_cm,
});

describe("poidsLisse", () => {
  const mesures = [mesure("2026-10-05", 83.2), mesure("2026-10-08", 82.8), mesure("2026-10-11", 82.4), mesure("2026-10-11", null, 91)];

  it("moyenne les relevés des 7 derniers jours, en ignorant les valeurs absentes", () => {
    // Fenêtre du 5 au 11 octobre : 83,2 / 82,8 / 82,4.
    expect(poidsLisse(mesures, "2026-10-11")).toBeCloseTo(82.8, 5);
    // Fenêtre du 2 au 8 octobre : 83,2 / 82,8.
    expect(poidsLisse(mesures, "2026-10-08")).toBeCloseTo(83, 5);
  });

  it("renvoie null sans relevé dans la fenêtre", () => {
    expect(poidsLisse(mesures, "2026-10-20")).toBeNull();
    expect(poidsLisse([], "2026-10-11")).toBeNull();
  });
});

describe("evolutionPoids", () => {
  it("pesée hebdomadaire : compare au relevé de la semaine d'avant", () => {
    const mesures = [mesure("2026-10-04", 83), mesure("2026-10-11", 82.4)];
    expect(evolutionPoids(mesures, "2026-10-11")).toEqual({ actuel: 82.4, delta: -0.6, ageJours: 0 });
  });

  it("reste ancrée sur le dernier relevé et signale son ancienneté", () => {
    const mesures = [mesure("2026-10-04", 83), mesure("2026-10-11", 82.4)];
    expect(evolutionPoids(mesures, "2026-10-14")).toEqual({ actuel: 82.4, delta: -0.6, ageJours: 3 });
  });

  it("lisse plusieurs pesées dans la semaine", () => {
    const mesures = [mesure("2026-10-04", 83), mesure("2026-10-09", 82), mesure("2026-10-11", 83)];
    // lissé au 11 : (82 + 83) / 2 = 82,5 ; lissé au 04 : 83
    expect(evolutionPoids(mesures, "2026-10-11")).toEqual({ actuel: 82.5, delta: -0.5, ageJours: 0 });
  });

  it("sans point de comparaison, pas de delta ; sans relevé, rien", () => {
    expect(evolutionPoids([mesure("2026-10-11", 82.4)], "2026-10-11")).toEqual({ actuel: 82.4, delta: null, ageJours: 0 });
    expect(evolutionPoids([], "2026-10-11")).toBeNull();
    expect(evolutionPoids([mesure("2026-10-11", null, 91)], "2026-10-11")).toBeNull();
  });

  it("ignore un relevé daté après aujourd'hui", () => {
    expect(evolutionPoids([mesure("2026-10-20", 80)], "2026-10-11")).toBeNull();
  });
});

describe("evolutionTaille", () => {
  it("compare au relevé le plus récent d'au moins 6 jours plus tôt", () => {
    const mesures = [mesure("2026-09-27", null, 93), mesure("2026-10-04", null, 92), mesure("2026-10-08", null, 91.5), mesure("2026-10-11", null, 91)];
    expect(evolutionTaille(mesures, "2026-10-11")).toEqual({ actuel: 91, delta: -1, ageJours: 0 });
  });

  it("pas de delta quand aucun relevé n'est assez ancien", () => {
    const mesures = [mesure("2026-10-09", null, 92), mesure("2026-10-11", null, 91)];
    expect(evolutionTaille(mesures, "2026-10-11")).toEqual({ actuel: 91, delta: null, ageJours: 0 });
    expect(evolutionTaille([], "2026-10-11")).toBeNull();
  });
});

describe("syntheseKcal", () => {
  const jour = (date: string, kcal: number, extra: Partial<JourKcal> = {}): JourKcal => ({
    date,
    kcal,
    cible: 2000,
    nbRepas: 3,
    libre: false,
    aujourdhui: false,
    ...extra,
  });

  it("moyenne les jours évalués et compte ceux restés dans la limite", () => {
    const res = syntheseKcal([jour("2026-10-05", 1800), jour("2026-10-06", 2100), jour("2026-10-07", 2000.4)]);
    expect(res).toEqual({ moyenne: 1967, cibleMoyenne: 2000, nbJours: 3, nbDansLimite: 2 });
  });

  it("exclut les jours libres, vides, sans objectif et la journée en cours", () => {
    const res = syntheseKcal([
      jour("2026-10-05", 1800),
      jour("2026-10-06", 4000, { libre: true }),
      jour("2026-10-07", 0, { nbRepas: 0 }),
      jour("2026-10-08", 2500, { cible: null }),
      jour("2026-10-09", 900, { aujourdhui: true }),
    ]);
    expect(res).toEqual({ moyenne: 1800, cibleMoyenne: 2000, nbJours: 1, nbDansLimite: 1 });
  });

  it("renvoie null quand aucun jour n'est évalué", () => {
    expect(syntheseKcal([])).toBeNull();
    expect(syntheseKcal([jour("2026-10-05", 4000, { libre: true })])).toBeNull();
  });
});

describe("kcalParJour : parité avec le calcul de l'app", () => {
  const aliment = { kcal_100g: 200, proteines_100g: 10, glucides_100g: 20, lipides_100g: 5 };
  const recetteOverride = { portions: 4, kcal_portion: 300, proteines_portion: 20, glucides_portion: 30, lipides_portion: 10, recette_ingredients: [] };
  const recetteCalculee = {
    portions: 2,
    kcal_portion: null,
    proteines_portion: null,
    glucides_portion: null,
    lipides_portion: null,
    recette_ingredients: [{ quantite: 100, aliment }],
  };
  const entrees: EntreeJournal[] = [
    { date: "2026-10-05", quantite: 150, aliment, recette: null },
    { date: "2026-10-05", quantite: 2, aliment: null, recette: recetteOverride },
    { date: "2026-10-06", quantite: 1, aliment: null, recette: recetteCalculee },
    { date: "2026-10-06", quantite: 1, aliment: null, recette: null }, // orpheline
  ];

  it("donne les mêmes kcal par jour que nutritionEntree, orphelines ignorées", () => {
    const attendu = new Map<string, number>();
    for (const entree of entrees) {
      const n = nutritionEntree(entree);
      if (n) attendu.set(entree.date, (attendu.get(entree.date) ?? 0) + n.kcal);
    }
    const res = kcalParJour(entrees as EntreeKcal[]);
    expect(res.get("2026-10-05")).toEqual({ kcal: attendu.get("2026-10-05"), nbRepas: 2 });
    expect(res.get("2026-10-06")).toEqual({ kcal: attendu.get("2026-10-06"), nbRepas: 1 });
  });
});

describe("joursKcalDepuisBilan / syntheseSeances", () => {
  const jourBilan = (date: string, statut: JourBilan["statut"]): JourBilan => ({
    date,
    jourType: "repos",
    statut,
    consomme: { kcal: 1800, proteines: 100, glucides: 0, lipides: 0 },
    cible: { kcal: 2000, proteines: 140 },
    nbRepas: 3,
    gravite: null,
  });

  it("marque libre et aujourd'hui à partir du statut et de la date", () => {
    const jours = joursKcalDepuisBilan([jourBilan("2026-10-10", "libre"), jourBilan("2026-10-11", "en_cours")], "2026-10-11");
    expect(jours).toEqual([
      { date: "2026-10-10", kcal: 1800, cible: 2000, nbRepas: 3, libre: true, aujourdhui: false },
      { date: "2026-10-11", kcal: 1800, cible: 2000, nbRepas: 3, libre: false, aujourdhui: true },
    ]);
  });

  it("compte les séances faites", () => {
    expect(syntheseSeances([{ statut: "faite" }, { statut: "prevue" }, { statut: "faite" }])).toEqual({ faites: 2, total: 3 });
  });
});

describe("semaineDe / bilanDu", () => {
  it("la semaine va du lundi au dimanche", () => {
    expect(semaineDe("2026-10-14")).toEqual({ debut: "2026-10-12", fin: "2026-10-18" });
    expect(semaineDe("2026-10-11")).toEqual({ debut: "2026-10-05", fin: "2026-10-11" });
  });

  const base = { today: "2026-10-11", jour: 0, heure: "18:00:00", dernierEnvoi: null };
  it("dimanche à 18h : oui ; avant : non ; autre jour : non", () => {
    expect(bilanDu({ ...base, maintenantMinutes: 18 * 60 })).toBe(true);
    expect(bilanDu({ ...base, maintenantMinutes: 18 * 60 - 1 })).toBe(false);
    expect(bilanDu({ ...base, today: "2026-10-12", maintenantMinutes: 18 * 60 })).toBe(false);
  });
  it("rattrape un retard dans la tolérance, jamais deux fois", () => {
    expect(bilanDu({ ...base, maintenantMinutes: 21 * 60 })).toBe(true);
    expect(bilanDu({ ...base, maintenantMinutes: 21 * 60 + 1 })).toBe(false);
    expect(bilanDu({ ...base, dernierEnvoi: "2026-10-11", maintenantMinutes: 18 * 60 })).toBe(false);
  });
});

describe("formaterDelta / composerBilanHebdo", () => {
  it("signe les écarts avec un vrai moins, et dit « stable » à zéro", () => {
    expect(formaterDelta(-0.6, "kg")).toBe(`−${nombreFr(0.6, 1)} kg`);
    expect(formaterDelta(0.4, "kg")).toBe(`+${nombreFr(0.4, 1)} kg`);
    expect(formaterDelta(0, "cm")).toBe("stable");
  });

  it("résume la semaine, ton neutre", () => {
    const message = composerBilanHebdo({
      kcal: { moyenne: 1920, cibleMoyenne: 2000, nbJours: 6, nbDansLimite: 5 },
      seances: { faites: 2, total: 3 },
      poids: { actuel: 82.4, delta: -0.6, ageJours: 0 },
      taille: { actuel: 91, delta: -1, ageJours: 0 },
    });
    expect(message.title).toBe("Bilan de la semaine");
    expect(message.body.split("\n")).toEqual([
      `Kcal : ${nombreFr(1920)} / ${nombreFr(2000)} en moyenne (6 jours)`,
      "Séances : 2/3 faites",
      `Poids : ${nombreFr(82.4, 1)} kg (−${nombreFr(0.6, 1)} kg)`,
      `Tour de taille : ${nombreFr(91, 1)} cm (−${nombreFr(1, 1)} cm)`,
    ]);
  });

  it("dit simplement ce qui manque, sans reproche", () => {
    const message = composerBilanHebdo({
      kcal: null,
      seances: { faites: 0, total: 0 },
      poids: { actuel: 82.4, delta: null, ageJours: 12 },
      taille: null,
    });
    expect(message.body.split("\n")).toEqual([
      "Kcal : pas assez de jours saisis",
      "Séances : aucune planifiée",
      `Poids : ${nombreFr(82.4, 1)} kg · relevé il y a 12 jours`,
      "Tour de taille : pas de relevé",
    ]);
  });
});
