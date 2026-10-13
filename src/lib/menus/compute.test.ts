import { describe, expect, it } from "vitest";
import {
  CRENEAUX_MENU,
  formaterQuantiteCourses,
  joursDeLaSemaine,
  libellesCoursesDepuisMenu,
  repasSemaineSuivante,
  semaineDepuisParam,
  type LigneMenuCourses,
} from "./compute";

describe("calendrier", () => {
  it("ramène n'importe quel jour valide au lundi de sa semaine", () => {
    expect(semaineDepuisParam("2026-10-14", "2026-01-01")).toBe("2026-10-12"); // mercredi
    expect(semaineDepuisParam("2026-10-18", "2026-01-01")).toBe("2026-10-12"); // dimanche
    expect(semaineDepuisParam("2026-10-12", "2026-01-01")).toBe("2026-10-12"); // lundi
  });

  it("retombe sur la semaine d'aujourd'hui si le paramètre est absent ou invalide", () => {
    expect(semaineDepuisParam(undefined, "2026-10-14")).toBe("2026-10-12");
    expect(semaineDepuisParam("pas-une-date", "2026-10-14")).toBe("2026-10-12");
    expect(semaineDepuisParam("2026-13-45", "2026-10-14")).toBe("2026-10-12");
  });

  it("liste les 7 jours du lundi au dimanche, y compris à cheval sur deux mois", () => {
    expect(joursDeLaSemaine("2026-10-26")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("affiche la collation avant le dîner", () => {
    expect(CRENEAUX_MENU).toEqual(["petit_dej", "dejeuner", "collation", "diner"]);
  });
});

describe("formaterQuantiteCourses", () => {
  it("arrondit vers le haut et passe en kg / L à partir de 1000", () => {
    expect(formaterQuantiteCourses(600, "g")).toBe("600 g");
    expect(formaterQuantiteCourses(250.2, "ml")).toBe("251 ml");
    expect(formaterQuantiteCourses(1200, "g")).toBe("1,2 kg");
    expect(formaterQuantiteCourses(1510, "ml")).toBe("1,6 L");
  });

  it("accorde les pièces", () => {
    expect(formaterQuantiteCourses(1, "piece")).toBe("1 pièce");
    expect(formaterQuantiteCourses(5.2, "piece")).toBe("6 pièces");
  });
});

describe("libellesCoursesDepuisMenu", () => {
  const poulet = { nom: "Poulet", quantite: 400, unite: "g" as const };
  const riz = { nom: "Riz", quantite: 200, unite: "g" as const };
  const recette = (portions: number): LigneMenuCourses["recette"] => ({
    portions,
    ingredients: [poulet, riz],
    libres: [],
  });

  it("ramène la quantité d'une recette au nombre de portions prévues", () => {
    const lignes: LigneMenuCourses[] = [{ quantite: 2, recette: recette(4), aliment: null }];
    expect(libellesCoursesDepuisMenu(lignes)).toEqual(["Poulet, 200 g", "Riz, 100 g"]);
  });

  it("additionne le même ingrédient sur plusieurs créneaux, sans tenir compte casse ni accents", () => {
    const lignes: LigneMenuCourses[] = [
      { quantite: 4, recette: recette(4), aliment: null },
      {
        quantite: 2,
        recette: { portions: 2, ingredients: [{ nom: "poulet", quantite: 300, unite: "g" }], libres: [] },
        aliment: null,
      },
    ];
    expect(libellesCoursesDepuisMenu(lignes)).toEqual(["Poulet, 700 g", "Riz, 200 g"]);
  });

  it("ne mélange pas deux unités du même nom", () => {
    const lignes: LigneMenuCourses[] = [
      {
        quantite: 1,
        recette: {
          portions: 1,
          ingredients: [
            { nom: "Œuf", quantite: 2, unite: "piece" },
            { nom: "Œuf", quantite: 100, unite: "g" },
          ],
          libres: [],
        },
        aliment: null,
      },
    ];
    expect(libellesCoursesDepuisMenu(lignes)).toEqual(["Œuf, 2 pièces", "Œuf, 100 g"]);
  });

  it("compte un aliment seul en g/ml, ou en pièces s'il a un poids par pièce", () => {
    const lignes: LigneMenuCourses[] = [
      { quantite: 250, recette: null, aliment: { nom: "Yaourt grec", unite: "g", poidsUniteG: null } },
      { quantite: 360, recette: null, aliment: { nom: "Pomme", unite: "piece", poidsUniteG: 180 } },
    ];
    expect(libellesCoursesDepuisMenu(lignes)).toEqual(["Yaourt grec, 250 g", "Pomme, 2 pièces"]);
  });

  it("garde les ingrédients libres tels quels, une seule fois", () => {
    const libres = [
      { nom: "Sel", quantite: null },
      { nom: "Curry", quantite: "1 cuillère" },
    ];
    const lignes: LigneMenuCourses[] = [
      { quantite: 2, recette: { portions: 4, ingredients: [], libres }, aliment: null },
      { quantite: 1, recette: { portions: 4, ingredients: [], libres }, aliment: null },
    ];
    expect(libellesCoursesDepuisMenu(lignes)).toEqual(["Sel", "Curry, 1 cuillère"]);
  });

  it("ne renvoie rien pour un menu vide ou une recette sans ingrédient", () => {
    expect(libellesCoursesDepuisMenu([])).toEqual([]);
    expect(
      libellesCoursesDepuisMenu([{ quantite: 1, recette: { portions: 1, ingredients: [], libres: [] }, aliment: null }])
    ).toEqual([]);
  });
});

describe("repasSemaineSuivante", () => {
  it("décale chaque repas de 7 jours en gardant créneau, contenu et quantité", () => {
    const repas = [
      { date: "2026-10-26", moment: "dejeuner" as const, aliment_id: null, recette_id: "r1", quantite: 2 },
      { date: "2026-11-01", moment: "collation" as const, aliment_id: "a1", recette_id: null, quantite: 150 },
    ];
    expect(repasSemaineSuivante(repas)).toEqual([
      { date: "2026-11-02", moment: "dejeuner", aliment_id: null, recette_id: "r1", quantite: 2 },
      { date: "2026-11-08", moment: "collation", aliment_id: "a1", recette_id: null, quantite: 150 },
    ]);
  });

  it("ne reprend aucune autre colonne (id, mange, lien Journal)", () => {
    const copie = repasSemaineSuivante([
      { date: "2026-10-12", moment: "diner", aliment_id: "a1", recette_id: null, quantite: 100, id: "x", mange: true } as never,
    ]);
    expect(Object.keys(copie[0]).sort()).toEqual(["aliment_id", "date", "moment", "quantite", "recette_id"]);
  });

  it("renvoie une liste vide pour une semaine vide", () => {
    expect(repasSemaineSuivante([])).toEqual([]);
  });
});
