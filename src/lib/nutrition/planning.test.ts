import { describe, expect, it } from "vitest";
import { estJourType, jourTypePourDate } from "./planning";

describe("jourTypePourDate", () => {
  it("aucune date marquée : tous les jours en repos", () => {
    expect(jourTypePourDate("2026-10-05", [])).toBe("repos");
  });

  it("date marquée : entraînement ; les autres : repos", () => {
    const dates = ["2026-10-05", "2026-10-09"];
    expect(jourTypePourDate("2026-10-05", dates)).toBe("entrainement");
    expect(jourTypePourDate("2026-10-06", dates)).toBe("repos");
    expect(jourTypePourDate("2026-10-09", dates)).toBe("entrainement");
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
