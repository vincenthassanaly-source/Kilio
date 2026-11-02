import { describe, expect, it } from "vitest";
import {
  POINTS_MAX,
  POINT_MAX,
  RESUME_MAX,
  construirePromptDescription,
  lireDescription,
} from "./description";

describe("construirePromptDescription", () => {
  it("mentionne le nom et la catégorie du document", () => {
    const prompt = construirePromptDescription("Facture EDF", "Maison");
    expect(prompt).toContain("« Facture EDF »");
    expect(prompt).toContain("Catégorie : « Maison »");
  });

  it("omet la catégorie quand il n'y en a pas", () => {
    expect(construirePromptDescription("Passeport", null)).not.toContain("Catégorie");
  });
});

describe("lireDescription", () => {
  it("nettoie le résumé et les puces", () => {
    expect(
      lireDescription({
        resume: "  Facture   d'électricité \n de mars. ",
        points: ["- Montant : 84,20 €", "• Échéance : 15/04", "  "],
      })
    ).toEqual({
      resume: "Facture d'électricité de mars.",
      points: ["Montant : 84,20 €", "Échéance : 15/04"],
    });
  });

  it("limite le nombre et la longueur des textes", () => {
    const resultat = lireDescription({
      resume: "a".repeat(RESUME_MAX + 50),
      points: Array.from({ length: POINTS_MAX + 4 }, () => "b".repeat(POINT_MAX + 50)),
    });
    expect(resultat?.resume.length).toBe(RESUME_MAX);
    expect(resultat?.points).toHaveLength(POINTS_MAX);
    expect(resultat?.points.every((p) => p.length === POINT_MAX)).toBe(true);
  });

  it("accepte un résumé sans puces, et des puces sans résumé", () => {
    expect(lireDescription({ resume: "Un contrat.", points: [] })).toEqual({ resume: "Un contrat.", points: [] });
    expect(lireDescription({ resume: "", points: ["Durée : 12 mois"] })).toEqual({
      resume: "",
      points: ["Durée : 12 mois"],
    });
  });

  it("ignore les puces qui ne sont pas du texte", () => {
    expect(lireDescription({ resume: "Ok.", points: [3, null, "Vrai"] })?.points).toEqual(["Vrai"]);
  });

  it("renvoie null quand rien n'est exploitable", () => {
    expect(lireDescription(null)).toBeNull();
    expect(lireDescription("texte")).toBeNull();
    expect(lireDescription({})).toBeNull();
    expect(lireDescription({ resume: " ", points: "pas une liste" })).toBeNull();
  });
});
