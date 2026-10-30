import { describe, expect, it } from "vitest";
import {
  INSTRUCTION_MAX,
  categoriesVidees,
  construirePromptReorganisation,
  lireReponseReorganisation,
  nettoyerInstruction,
  regrouperChangements,
  type DocumentPourReorganisation,
} from "./reorganisation";

const CATEGORIES = ["Identité", "Santé", "Assurance", "Autre"];

const DOCUMENTS: DocumentPourReorganisation[] = [
  { id: "d1", nom: "Fiche de paie - mars 2026", categorie: "Autre", notes: null },
  { id: "d2", nom: "Fiche de paie - avril 2026", categorie: "Autre", notes: "reçue par mail" },
  { id: "d3", nom: "Carte vitale", categorie: "Santé", notes: null },
  { id: "d4", nom: "Brouillon sans catégorie", categorie: null, notes: null },
];

describe("nettoyerInstruction", () => {
  it("normalise les espaces et plafonne la longueur", () => {
    expect(nettoyerInstruction("  pas   plus de\n8 catégories ")).toBe("pas plus de 8 catégories");
    expect(nettoyerInstruction("x".repeat(INSTRUCTION_MAX + 50))).toHaveLength(INSTRUCTION_MAX);
    expect(nettoyerInstruction(undefined)).toBe("");
  });
});

describe("construirePromptReorganisation", () => {
  it("numérote les documents et donne l'effectif de chaque catégorie", () => {
    const prompt = construirePromptReorganisation(DOCUMENTS, CATEGORIES, "");
    expect(prompt).toContain("1. Fiche de paie - mars 2026 | catégorie : Autre");
    expect(prompt).toContain("4. Brouillon sans catégorie | catégorie : aucune");
    expect(prompt).toContain("« Autre » (2)");
    expect(prompt).toContain("« Identité » (0)");
    expect(prompt).toContain("notes : reçue par mail");
  });

  it("n'ajoute la préférence de l'utilisateur que s'il y en a une", () => {
    expect(construirePromptReorganisation(DOCUMENTS, CATEGORIES, "")).not.toContain("Préférence");
    expect(construirePromptReorganisation(DOCUMENTS, CATEGORIES, "pas plus de 8 catégories")).toContain(
      "« pas plus de 8 catégories »"
    );
  });
});

describe("lireReponseReorganisation", () => {
  it("ne rend que les documents qui changent de catégorie", () => {
    const changements = lireReponseReorganisation(
      {
        documents: [
          { i: 1, categorie: "Travail" },
          { i: 3, categorie: "Santé" },
          { i: 4, categorie: "Assurance" },
        ],
      },
      DOCUMENTS,
      CATEGORIES
    );
    expect(changements).toEqual([
      { id: "d1", nom: "Fiche de paie - mars 2026", de: "Autre", vers: "Travail", nouvelle: true },
      { id: "d4", nom: "Brouillon sans catégorie", de: null, vers: "Assurance", nouvelle: false },
    ]);
  });

  it("reconnaît une catégorie existante malgré la casse et les accents", () => {
    const [changement] = lireReponseReorganisation({ documents: [{ i: 1, categorie: "sante" }] }, DOCUMENTS, CATEGORIES);
    expect(changement).toMatchObject({ vers: "Santé", nouvelle: false });
  });

  it("unifie deux nouvelles catégories de même sens", () => {
    const changements = lireReponseReorganisation(
      {
        documents: [
          { i: 1, categorie: "Travail" },
          { i: 2, categorie: "travail" },
        ],
      },
      DOCUMENTS,
      CATEGORIES
    );
    expect(changements.map((c) => c.vers)).toEqual(["Travail", "Travail"]);
  });

  it("ignore numéros inconnus, répétés, catégories vides et lignes mal formées", () => {
    const changements = lireReponseReorganisation(
      {
        documents: [
          { i: 0, categorie: "Travail" },
          { i: 99, categorie: "Travail" },
          { i: 1.5, categorie: "Travail" },
          { i: "1", categorie: "Travail" },
          { i: 2, categorie: "   " },
          null,
          "texte",
          { i: 1, categorie: "Travail" },
          { i: 1, categorie: "Banque" },
        ],
      },
      DOCUMENTS,
      CATEGORIES
    );
    expect(changements).toEqual([
      { id: "d1", nom: "Fiche de paie - mars 2026", de: "Autre", vers: "Travail", nouvelle: true },
    ]);
  });

  it("ne plante pas sur une réponse qui n'a pas la forme attendue", () => {
    expect(lireReponseReorganisation(null, DOCUMENTS, CATEGORIES)).toEqual([]);
    expect(lireReponseReorganisation({ documents: "rien" }, DOCUMENTS, CATEGORIES)).toEqual([]);
    expect(lireReponseReorganisation("n'importe quoi", DOCUMENTS, CATEGORIES)).toEqual([]);
  });
});

describe("regrouperChangements", () => {
  it("fait un groupe par couple (ancienne, nouvelle), le plus gros d'abord puis par destination", () => {
    const groupes = regrouperChangements([
      { id: "a", nom: "A", de: "Autre", vers: "Travail", nouvelle: true },
      { id: "b", nom: "B", de: "Santé", vers: "Assurance", nouvelle: false },
      { id: "c", nom: "C", de: "Autre", vers: "Travail", nouvelle: true },
      { id: "d", nom: "D", de: null, vers: "Travail", nouvelle: true },
    ]);
    expect(groupes.map((g) => [g.de, g.vers, g.changements.length])).toEqual([
      ["Autre", "Travail", 2],
      ["Santé", "Assurance", 1],
      [null, "Travail", 1],
    ]);
  });
});

describe("categoriesVidees", () => {
  const COMPTES = { Autre: 3, Santé: 2, Assurance: 1 };

  it("repère une catégorie dont tous les documents partent", () => {
    expect(categoriesVidees([{ de: "Assurance" }, { de: "Autre" }], COMPTES)).toEqual(["Assurance"]);
  });

  it("garde une catégorie qui conserve un document (le vrac compte)", () => {
    expect(categoriesVidees([{ de: "Autre" }, { de: "Autre" }], COMPTES)).toEqual([]);
    expect(categoriesVidees([{ de: "Autre" }, { de: "Autre" }, { de: "Autre" }], COMPTES)).toEqual(["Autre"]);
  });

  it("ignore les documents sans catégorie d'origine", () => {
    expect(categoriesVidees([{ de: null }], COMPTES)).toEqual([]);
  });
});
