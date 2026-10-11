import { describe, expect, it } from "vitest";
import { nutritionEntree, type EntreeJournal } from "./bilan";
import {
  alerteKcalDue,
  composerAlerteKcal,
  kcalEntree,
  rappelSaisieDu,
  resumeKcal,
  type EntreeKcal,
} from "../../../supabase/functions/envoyer-alertes-nutrition/compose";

const aliment = { kcal_100g: 200, proteines_100g: 10, glucides_100g: 20, lipides_100g: 5 };

const recetteOverride = {
  portions: 4,
  kcal_portion: 300,
  proteines_portion: 20,
  glucides_portion: 30,
  lipides_portion: 10,
  recette_ingredients: [],
};
const recetteCalculee = {
  portions: 2,
  kcal_portion: null,
  proteines_portion: null,
  glucides_portion: null,
  lipides_portion: null,
  recette_ingredients: [{ quantite: 100, aliment }],
};

const entrees: EntreeJournal[] = [
  { date: "2026-10-14", quantite: 150, aliment, recette: null },
  { date: "2026-10-14", quantite: 2, aliment: null, recette: recetteOverride },
  { date: "2026-10-14", quantite: 1, aliment: null, recette: recetteCalculee },
  { date: "2026-10-14", quantite: 1, aliment: null, recette: null }, // orpheline
];

describe("kcalEntree : parité avec le calcul de l'app", () => {
  it("donne les mêmes kcal que nutritionEntree pour chaque entrée", () => {
    for (const entree of entrees) {
      const attendu = nutritionEntree(entree);
      expect(kcalEntree(entree as EntreeKcal)).toBe(attendu === null ? null : attendu.kcal);
    }
  });

  it("somme les entrées en ignorant les orphelines", () => {
    // 150 g à 200 kcal/100 g + 2 portions à 300 + 1 portion de (200 kcal / 2 portions)
    expect(resumeKcal(entrees as EntreeKcal[])).toEqual({ kcal: 300 + 600 + 100, nbRepas: 3 });
  });
});

describe("alerteKcalDue", () => {
  const base = { cible: 2000, jourLibre: false, dejaEnvoyee: false };

  it("alerte à partir de 85 % de la limite", () => {
    expect(alerteKcalDue({ ...base, kcal: 1699 })).toBeNull();
    expect(alerteKcalDue({ ...base, kcal: 1700 })).toBe("approche");
    expect(alerteKcalDue({ ...base, kcal: 2000 })).toBe("approche");
  });

  it("distingue le dépassement, sur les valeurs arrondies", () => {
    expect(alerteKcalDue({ ...base, kcal: 2000.4 })).toBe("approche");
    expect(alerteKcalDue({ ...base, kcal: 2000.6 })).toBe("depasse");
    expect(alerteKcalDue({ ...base, kcal: 2400 })).toBe("depasse");
  });

  it("ne part jamais un jour libre, deux fois, ou sans objectif", () => {
    expect(alerteKcalDue({ ...base, kcal: 2400, jourLibre: true })).toBeNull();
    expect(alerteKcalDue({ ...base, kcal: 2400, dejaEnvoyee: true })).toBeNull();
    expect(alerteKcalDue({ ...base, kcal: 2400, cible: null })).toBeNull();
    expect(alerteKcalDue({ ...base, kcal: 2400, cible: 0 })).toBeNull();
  });
});

describe("composerAlerteKcal", () => {
  it("annonce ce qu'il reste à l'approche de la limite", () => {
    expect(composerAlerteKcal({ niveau: "approche", kcal: 1750.2, cible: 2000 })).toEqual({
      title: "Limite kcal bientôt atteinte",
      body: "1750 / 2000 kcal : il te reste 250 kcal aujourd'hui.",
    });
  });

  it("reste neutre en cas de dépassement", () => {
    expect(composerAlerteKcal({ niveau: "depasse", kcal: 2180, cible: 2000 })).toEqual({
      title: "Objectif kcal dépassé",
      body: "2180 / 2000 kcal (+180). Demain repart de zéro.",
    });
  });
});

describe("rappelSaisieDu", () => {
  const base = { today: "2026-10-14", heure: "20:00:00", nbRepas: 0, dernierEnvoi: null };

  it("journal vide à l'heure : oui", () => expect(rappelSaisieDu({ ...base, maintenantMinutes: 20 * 60 })).toBe(true));
  it("avant l'heure : non", () => expect(rappelSaisieDu({ ...base, maintenantMinutes: 20 * 60 - 1 })).toBe(false));
  it("rattrape un cron manqué dans la tolérance (3 h), pas au-delà", () => {
    expect(rappelSaisieDu({ ...base, maintenantMinutes: 23 * 60 })).toBe(true);
    expect(rappelSaisieDu({ ...base, maintenantMinutes: 23 * 60 + 1 })).toBe(false);
  });
  it("jamais si un repas est saisi, ni deux fois", () => {
    expect(rappelSaisieDu({ ...base, nbRepas: 1, maintenantMinutes: 20 * 60 })).toBe(false);
    expect(rappelSaisieDu({ ...base, dernierEnvoi: "2026-10-14", maintenantMinutes: 20 * 60 })).toBe(false);
  });
});
