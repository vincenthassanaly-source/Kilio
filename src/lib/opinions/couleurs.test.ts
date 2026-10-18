import { describe, expect, it } from "vitest";
import {
  COULEURS_PARTI,
  couleurOuDefaut,
  couleurSuivante,
  decouperTermes,
  estCouleur,
  nettoyerTermes,
  termesDepuisJson,
} from "./couleurs";

describe("couleur d'un parti", () => {
  it("reconnaît la palette et retombe sur la première teinte sinon", () => {
    expect(estCouleur("prune")).toBe(true);
    expect(estCouleur("rouge")).toBe(false);
    expect(couleurOuDefaut("inconnue")).toBe(COULEURS_PARTI[0]);
  });

  it("donne la première teinte libre, puis recommence la palette", () => {
    expect(couleurSuivante([])).toBe("indigo");
    expect(couleurSuivante(["indigo", "corail"])).toBe("olive");
    expect(couleurSuivante([...COULEURS_PARTI])).toBe("indigo");
    expect(couleurSuivante([...COULEURS_PARTI, "indigo"])).toBe("corail");
  });
});

describe("termes", () => {
  it("lit le JSON stocké avec tolérance", () => {
    expect(termesDepuisJson([{ terme: " TVA ", definition: " un impôt " }, { terme: "PIB" }, { terme: "" }, 3, null])).toEqual([
      { terme: "TVA", definition: "un impôt" },
      { terme: "PIB", definition: null },
    ]);
    expect(termesDepuisJson("nope")).toEqual([]);
  });

  it("refuse un doublon, un mot absent du texte et un mot qui n'est qu'un morceau d'un autre", () => {
    const texte = "Baisser la TVA sur les produits de base.";
    expect(nettoyerTermes([{ terme: "tva", definition: "" }, { terme: "TVA", definition: "" }], texte)).toMatch(/double/);
    expect(nettoyerTermes([{ terme: "ISF", definition: "" }], texte)).toMatch(/n'apparaît pas/);
    expect(nettoyerTermes([{ terme: "base", definition: "" }], "Une réforme de la basecamp")).toMatch(/n'apparaît pas/);
    expect(nettoyerTermes([{ terme: "TVA", definition: " un impôt " }, { terme: " ", definition: "" }], texte)).toEqual([
      { terme: "TVA", definition: "un impôt" },
    ]);
  });

  it("découpe le texte, garde la casse d'origine et ignore un terme disparu", () => {
    const termes = [
      { terme: "tva", definition: "un impôt" },
      { terme: "fantôme", definition: null },
    ];
    expect(decouperTermes("La TVA baisse, la TVA.", termes)).toEqual([
      { texte: "La ", terme: null },
      { texte: "TVA", terme: termes[0] },
      { texte: " baisse, la ", terme: null },
      { texte: "TVA", terme: termes[0] },
      { texte: ".", terme: null },
    ]);
    expect(decouperTermes("Rien", [])).toEqual([{ texte: "Rien", terme: null }]);
  });

  it("préfère le terme le plus long quand deux se recouvrent", () => {
    const court = { terme: "impôt", definition: null };
    const long = { terme: "impôt sur la fortune", definition: "x" };
    const segments = decouperTermes("Supprimer l'impôt sur la fortune", [court, long]);
    expect(segments.filter((s) => s.terme).map((s) => s.texte)).toEqual(["impôt sur la fortune"]);
  });
});
