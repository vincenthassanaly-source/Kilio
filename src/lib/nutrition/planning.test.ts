import { describe, expect, it } from "vitest";
import { estJourType, jourSemaineIso, jourTypePourDate, normaliserJours } from "./planning";

describe("jourSemaineIso", () => {
  it("numérote lundi = 1 et dimanche = 7", () => {
    expect(jourSemaineIso("2026-10-05")).toBe(1); // lundi
    expect(jourSemaineIso("2026-10-08")).toBe(4); // jeudi
    expect(jourSemaineIso("2026-10-11")).toBe(7); // dimanche
  });
});

describe("jourTypePourDate", () => {
  it("planning vide : tous les jours en repos", () => {
    expect(jourTypePourDate("2026-10-05", [])).toBe("repos");
    expect(jourTypePourDate("2026-10-11", [])).toBe("repos");
  });

  it("jour du planning : entraînement ; les autres : repos", () => {
    const planning = [1, 3, 5];
    expect(jourTypePourDate("2026-10-05", planning)).toBe("entrainement"); // lundi
    expect(jourTypePourDate("2026-10-06", planning)).toBe("repos"); // mardi
    expect(jourTypePourDate("2026-10-09", planning)).toBe("entrainement"); // vendredi
  });
});

describe("normaliserJours", () => {
  it("garde les jours valides, sans doublon, triés", () => {
    expect(normaliserJours([5, "1", 3, 3, 0, 8, "x", 1.5])).toEqual([1, 3, 5]);
  });

  it("valeur absente ou invalide : aucun jour", () => {
    expect(normaliserJours(null)).toEqual([]);
    expect(normaliserJours("1,2")).toEqual([]);
  });
});

describe("estJourType", () => {
  it("n'accepte que repos et entrainement", () => {
    expect(estJourType("repos")).toBe(true);
    expect(estJourType("entrainement")).toBe(true);
    expect(estJourType("sport")).toBe(false);
    expect(estJourType(null)).toBe(false);
  });
});
