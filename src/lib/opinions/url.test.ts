import { describe, expect, it } from "vitest";
import { ecrireEtatOpinions, lireEtatOpinions, type EtatOpinions } from "./url";

const DEFAUT: EtatOpinions = { onglet: "idees", statut: "tous", theme: "tous", parti: null };

describe("lireEtatOpinions", () => {
  it("sans paramètre : onglet Idées, aucun filtre", () => {
    expect(lireEtatOpinions(new URLSearchParams())).toEqual(DEFAUT);
  });

  it("lit l'onglet, les filtres et le parti ouvert", () => {
    expect(lireEtatOpinions(new URLSearchParams("onglet=partis&parti=p1"))).toEqual({ ...DEFAUT, onglet: "partis", parti: "p1" });
    expect(lireEtatOpinions(new URLSearchParams("statut=validee&theme=sante"))).toEqual({
      ...DEFAUT,
      statut: "validee",
      theme: "sante",
    });
  });

  it("ignore les valeurs inconnues", () => {
    expect(lireEtatOpinions(new URLSearchParams("onglet=autre&statut=x&theme=y&parti=%20"))).toEqual(DEFAUT);
  });
});

describe("ecrireEtatOpinions", () => {
  it("omet les valeurs par défaut", () => {
    expect(ecrireEtatOpinions(DEFAUT)).toBe("");
  });

  it("garde les filtres de l'onglet Idées seulement sur cet onglet", () => {
    expect(ecrireEtatOpinions({ ...DEFAUT, statut: "brouillon", theme: "travail" })).toBe("?statut=brouillon&theme=travail");
    expect(ecrireEtatOpinions({ ...DEFAUT, onglet: "profil", statut: "brouillon" })).toBe("?onglet=profil");
  });

  it("garde le parti ouvert sur l'onglet Partis", () => {
    expect(ecrireEtatOpinions({ ...DEFAUT, onglet: "partis", parti: "p1" })).toBe("?onglet=partis&parti=p1");
  });

  it("aller-retour stable", () => {
    const etat: EtatOpinions = { onglet: "partis", statut: "tous", theme: "tous", parti: "abc" };
    expect(lireEtatOpinions(new URLSearchParams(ecrireEtatOpinions(etat)))).toEqual(etat);
  });
});
