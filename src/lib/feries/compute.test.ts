import { describe, expect, it } from "vitest";
import { anneesDePlage, anneesManquantes, ferieParDate, parseReponseEtalab } from "./compute";

describe("parseReponseEtalab", () => {
  it("convertit la réponse en lignes triées", () => {
    expect(parseReponseEtalab({ "2026-05-01": "1er mai", "2026-01-01": " 1er janvier " })).toEqual([
      { date: "2026-01-01", nom: "1er janvier" },
      { date: "2026-05-01", nom: "1er mai" },
    ]);
  });

  it("ignore les entrées invalides et les réponses inattendues", () => {
    expect(parseReponseEtalab({ demain: "x", "2026-01-01": "", "2026-02-02": 3 })).toEqual([]);
    expect(parseReponseEtalab(null)).toEqual([]);
    expect(parseReponseEtalab(["2026-01-01"])).toEqual([]);
  });
});

describe("anneesDePlage", () => {
  it("liste les années couvertes", () => {
    expect(anneesDePlage("2026-12-20", "2027-01-10")).toEqual([2026, 2027]);
    expect(anneesDePlage("2026-03-01", "2026-03-31")).toEqual([2026]);
  });

  it("renvoie une liste vide si la plage est inversée ou invalide", () => {
    expect(anneesDePlage("2027-01-01", "2026-01-01")).toEqual([]);
    expect(anneesDePlage("abcd", "2026-01-01")).toEqual([]);
  });
});

describe("anneesManquantes", () => {
  it("ne garde que les années sans férié en base", () => {
    expect(anneesManquantes([2026, 2027], [{ date: "2026-01-01", nom: "1er janvier" }])).toEqual([2027]);
  });
});

describe("ferieParDate", () => {
  it("indexe le nom par date", () => {
    expect(ferieParDate([{ date: "2026-05-01", nom: "1er mai" }]).get("2026-05-01")).toBe("1er mai");
  });
});
