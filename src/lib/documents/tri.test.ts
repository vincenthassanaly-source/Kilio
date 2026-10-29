import { describe, expect, it } from "vitest";
import {
  NOM_MAX,
  cleTitre,
  construirePromptTri,
  lireReponseTri,
  nomDepuisFichier,
  trouverCategorie,
  trouverDoublonParTitre,
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

describe("cleTitre", () => {
  it("ignore la casse, les accents et la ponctuation", () => {
    expect(cleTitre("Carte d'identité - Vincent")).toBe(cleTitre("carte d identite  VINCENT"));
    expect(cleTitre("Facture EDF – mars 2026")).toBe("facture edf mars 2026");
  });

  it("distingue deux titres réellement différents", () => {
    expect(cleTitre("Fiche de paie - mars 2026")).not.toBe(cleTitre("Fiche de paie - avril 2026"));
  });
});

describe("trouverDoublonParTitre", () => {
  const EXISTANTS = [
    { id: "D1", nom: "Facture EDF - mars 2026" },
    { id: "D2", nom: "Carte d'identité - Vincent" },
  ];

  it("repère un titre identique malgré la casse et la ponctuation", () => {
    expect(trouverDoublonParTitre("carte d identite vincent", EXISTANTS)).toEqual({
      type: "titre",
      documentId: "D2",
      nom: "Carte d'identité - Vincent",
    });
  });

  it("ne signale rien pour un titre différent ou vide", () => {
    expect(trouverDoublonParTitre("Facture EDF - avril 2026", EXISTANTS)).toBeNull();
    expect(trouverDoublonParTitre("   ", EXISTANTS)).toBeNull();
    expect(trouverDoublonParTitre("Facture EDF - mars 2026", [])).toBeNull();
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

  it("demande de créer une catégorie large quand aucune ne convient franchement", () => {
    const prompt = construirePromptTri(CATEGORIES, "scan");
    expect(prompt).toContain("CRÉE une nouvelle catégorie");
    expect(prompt).toContain("un ou deux mots");
    // Catégorie large, pas un type de document.
    expect(prompt).toContain("pas « Fiche de paie »");
  });

  it("réserve « Autre » au dernier recours", () => {
    const prompt = construirePromptTri(CATEGORIES, "scan");
    expect(prompt).toContain("« Autre » est un dernier recours");
    expect(prompt).toContain("illisible ou impossible à classer");
    expect(prompt).not.toContain("même approximativement");
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
