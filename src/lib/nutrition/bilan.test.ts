import { describe, expect, it } from "vitest";
import {
  construireBilan,
  evaluerJour,
  nutritionEntree,
  serieEnCours,
  tauxReussite,
  type EntreeJournal,
  type JourBilan,
} from "./bilan";

const cible = { kcal: 2000, proteines: 150 };
const nutri = (kcal: number, proteines: number) => ({ kcal, proteines, glucides: 0, lipides: 0 });

describe("evaluerJour", () => {
  const base = { cible, nbRepas: 3, estAujourdhui: false };

  it("réussi : kcal sous le plafond et protéines au plancher", () => {
    expect(evaluerJour({ ...base, consomme: nutri(1900, 160) }).statut).toBe("reussi");
  });

  it("égalité aux cibles = réussi (valeurs arrondies)", () => {
    expect(evaluerJour({ ...base, consomme: nutri(2000.4, 149.6) }).statut).toBe("reussi");
  });

  it("raté léger : kcal ≤10 % au-dessus", () => {
    expect(evaluerJour({ ...base, consomme: nutri(2150, 160) })).toEqual({ statut: "rate", gravite: "leger" });
  });

  it("raté marqué : kcal >10 % au-dessus", () => {
    expect(evaluerJour({ ...base, consomme: nutri(2400, 160) })).toEqual({ statut: "rate", gravite: "marque" });
  });

  it("raté léger : protéines sous le plancher, kcal respectées", () => {
    expect(evaluerJour({ ...base, consomme: nutri(1800, 100) })).toEqual({ statut: "rate", gravite: "leger" });
  });

  it("kcal seules (proteinesRequises: false) : protéines basses ne font pas rater le jour", () => {
    expect(evaluerJour({ ...base, consomme: nutri(1800, 100), proteinesRequises: false }).statut).toBe("reussi");
  });

  it("kcal seules : un dépassement kcal reste raté", () => {
    expect(evaluerJour({ ...base, consomme: nutri(2150, 160), proteinesRequises: false })).toEqual({
      statut: "rate",
      gravite: "leger",
    });
  });

  it("vide : aucun repas saisi, même avec un objectif", () => {
    expect(evaluerJour({ ...base, nbRepas: 0, consomme: nutri(0, 0) }).statut).toBe("vide");
  });

  it("sans objectif : pas de cible pour ce type de jour", () => {
    expect(evaluerJour({ ...base, cible: null, consomme: nutri(1800, 100) }).statut).toBe("sans_objectif");
  });

  it("aujourd'hui : en cours tant que les kcal ne sont pas dépassées", () => {
    expect(evaluerJour({ ...base, estAujourdhui: true, consomme: nutri(900, 40) }).statut).toBe("en_cours");
  });

  it("aujourd'hui : raté dès que les kcal sont dépassées", () => {
    expect(evaluerJour({ ...base, estAujourdhui: true, consomme: nutri(2300, 40) }).statut).toBe("rate");
  });
});

describe("nutritionEntree", () => {
  const aliment = { kcal_100g: 200, proteines_100g: 20, glucides_100g: 10, lipides_100g: 5 };

  it("calcule un aliment à la quantité saisie", () => {
    const entree: EntreeJournal = { date: "2026-09-30", quantite: 150, aliment, recette: null };
    expect(nutritionEntree(entree)).toEqual({ kcal: 300, proteines: 30, glucides: 15, lipides: 7.5 });
  });

  it("utilise l'override nutritionnel d'une recette", () => {
    const entree: EntreeJournal = {
      date: "2026-09-30",
      quantite: 2,
      aliment: null,
      recette: {
        portions: 4,
        kcal_portion: 500,
        proteines_portion: 30,
        glucides_portion: 50,
        lipides_portion: 10,
        recette_ingredients: [],
      },
    };
    expect(nutritionEntree(entree)).toEqual({ kcal: 1000, proteines: 60, glucides: 100, lipides: 20 });
  });

  it("calcule une recette depuis ses ingrédients sans override", () => {
    const entree: EntreeJournal = {
      date: "2026-09-30",
      quantite: 1,
      aliment: null,
      recette: {
        portions: 2,
        kcal_portion: null,
        proteines_portion: null,
        glucides_portion: null,
        lipides_portion: null,
        recette_ingredients: [{ quantite: 200, aliment }],
      },
    };
    expect(nutritionEntree(entree)?.kcal).toBe(200);
  });

  it("ignore une entrée orpheline", () => {
    expect(nutritionEntree({ date: "2026-09-30", quantite: 1, aliment: null, recette: null })).toBeNull();
  });
});

describe("construireBilan", () => {
  const aliment = { kcal_100g: 100, proteines_100g: 10, glucides_100g: 0, lipides_100g: 0 };
  const entree = (date: string, quantite: number): EntreeJournal => ({ date, quantite, aliment, recette: null });
  const cibles = {
    repos: { kcal: 1800, proteines: 140 },
    entrainement: { kcal: 2200, proteines: 170 },
  };

  it("renvoie nbJours jours du plus ancien au plus récent, aujourd'hui inclus", () => {
    const jours = construireBilan({
      aujourdhui: "2026-09-30",
      nbJours: 3,
      entrees: [],
      joursEntrainement: [],
      cibles,
    });
    expect(jours.map((j) => j.date)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
  });

  it("agrège les repas d'un jour et applique la cible du type de jour déduit du planning", () => {
    const jours = construireBilan({
      aujourdhui: "2026-09-30",
      nbJours: 2,
      // 2000 g à 100 kcal/100 g = 2000 kcal, 200 g de protéines
      entrees: [entree("2026-09-29", 1000), entree("2026-09-29", 1000)],
      joursEntrainement: [2], // mardi : le 2026-09-29
      cibles,
    });
    const veille = jours[0];
    expect(veille.jourType).toBe("entrainement");
    expect(veille.nbRepas).toBe(2);
    expect(veille.consomme.kcal).toBe(2000);
    expect(veille.statut).toBe("reussi");
    expect(jours[1].statut).toBe("vide");
  });

  it("planning vide = repos, sans objectif si la cible manque", () => {
    const jours = construireBilan({
      aujourdhui: "2026-09-30",
      nbJours: 2,
      entrees: [entree("2026-09-29", 100)],
      joursEntrainement: [],
      cibles: { repos: null, entrainement: null },
    });
    expect(jours[0].jourType).toBe("repos");
    expect(jours[0].statut).toBe("sans_objectif");
  });
});

describe("tauxReussite / serieEnCours", () => {
  const jour = (statut: JourBilan["statut"]): JourBilan => ({
    date: "2026-09-01",
    jourType: "repos",
    statut,
    consomme: nutri(0, 0),
    cible: null,
    nbRepas: 0,
    gravite: null,
  });

  it("taux : seuls réussi et raté comptent", () => {
    const jours = [jour("reussi"), jour("rate"), jour("vide"), jour("en_cours"), jour("reussi")];
    expect(tauxReussite(jours)).toEqual({ reussis: 2, evalues: 3 });
  });

  it("série : coupée par un raté, épargnée par vide / en cours", () => {
    const jours = [jour("reussi"), jour("rate"), jour("reussi"), jour("vide"), jour("reussi"), jour("en_cours")];
    expect(serieEnCours(jours)).toEqual({ jours: 2, tronquee: false });
  });

  it("série : nulle si le dernier jour jugé est raté", () => {
    expect(serieEnCours([jour("reussi"), jour("rate")])).toEqual({ jours: 0, tronquee: false });
  });

  it("série : tronquée quand elle remonte jusqu'au début de la fenêtre", () => {
    expect(serieEnCours([jour("reussi"), jour("reussi")])).toEqual({ jours: 2, tronquee: true });
  });

  it("série : aucune donnée", () => {
    expect(serieEnCours([jour("vide")])).toEqual({ jours: 0, tronquee: false });
  });
});
