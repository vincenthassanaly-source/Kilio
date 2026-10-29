import { describe, expect, it } from "vitest";
import {
  NOM_MAX,
  construirePromptTri,
  lireReponseTri,
  nomDepuisFichier,
  trouverCategorie,
} from "./tri";

const CATEGORIES = ["Identité", "Véhicule", "Logement", "Santé", "Assurance", "Autre"];

describe("trouverCategorie", () => {
  it("ignore la casse et les accents et rend le nom exact de la liste", () => {
    expect(trouverCategorie("identite", CATEGORIES)).toBe("Identité");
    expect(trouverCategorie("  SANTÉ ", CATEGORIES)).toBe("Santé");
  });

  it("rend null pour une catégorie inconnue ou vide", () => {
    expect(trouverCategorie("Banque", CATEGORIES)).toBeNull();
    expect(trouverCategorie("  ", CATEGORIES)).toBeNull();
  });
});

describe("nomDepuisFichier", () => {
  it("retire l'extension et remplace les séparateurs", () => {
    expect(nomDepuisFichier("Facture_EDF-mars.pdf")).toBe("Facture EDF mars");
  });

  it("garde un nom par défaut quand rien ne reste", () => {
    expect(nomDepuisFichier(".pdf")).toBe("Document");
  });

  it("tronque un nom démesuré", () => {
    expect(nomDepuisFichier(`${"a".repeat(300)}.pdf`)).toHaveLength(NOM_MAX);
  });
});

describe("construirePromptTri", () => {
  it("liste les catégories existantes et le nom actuel", () => {
    const prompt = construirePromptTri(CATEGORIES, "scan0042");
    expect(prompt).toContain("« Santé »");
    expect(prompt).toContain("scan0042");
  });
});

describe("lireReponseTri", () => {
  it("reconnaît une catégorie existante malgré la casse", () => {
    expect(lireReponseTri({ nom: "Facture EDF - mars 2026", categorie: "logement" }, CATEGORIES, "scan")).toEqual({
      nom: "Facture EDF - mars 2026",
      categorie: "Logement",
      nouvelleCategorie: false,
    });
  });

  it("signale une catégorie nouvelle", () => {
    expect(lireReponseTri({ nom: "Relevé", categorie: "Banque" }, CATEGORIES, "scan")).toEqual({
      nom: "Relevé",
      categorie: "Banque",
      nouvelleCategorie: true,
    });
  });

  it("retombe sur le nom actuel et « Autre » quand la réponse est vide", () => {
    expect(lireReponseTri({ nom: "  ", categorie: "" }, CATEGORIES, "scan0042")).toEqual({
      nom: "scan0042",
      categorie: "Autre",
      nouvelleCategorie: false,
    });
  });

  it("n'invente pas « Autre » s'il n'existe pas", () => {
    expect(lireReponseTri({ nom: "x", categorie: "" }, ["Santé"], "scan").categorie).toBeNull();
  });

  it("ignore une réponse qui n'est pas un objet", () => {
    expect(lireReponseTri("n'importe quoi", CATEGORIES, "scan").nom).toBe("scan");
  });

  it("retire les guillemets autour du nom et le tronque", () => {
    expect(lireReponseTri({ nom: "« Carte vitale »", categorie: "Santé" }, CATEGORIES, "x").nom).toBe("Carte vitale");
    expect(lireReponseTri({ nom: "n".repeat(400), categorie: "Santé" }, CATEGORIES, "x").nom).toHaveLength(NOM_MAX);
  });
});
