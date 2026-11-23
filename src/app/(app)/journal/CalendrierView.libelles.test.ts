import { describe, expect, it } from "vitest";
import { bilanMois, libelleJourDuMois } from "./CalendrierView";

describe("libellés du calendrier", () => {
  it("nomme une case avec le jour et le mois", () => {
    expect(libelleJourDuMois("2026-11-12")).toBe("12 novembre");
    expect(libelleJourDuMois("2026-01-01")).toBe("1 janvier");
  });

  it("compte toujours en « soirs »", () => {
    expect(bilanMois(0)).toBe("Aucun soir écrit ce mois-ci.");
    expect(bilanMois(1)).toBe("1 soir écrit ce mois-ci.");
    expect(bilanMois(4)).toBe("4 soirs écrits ce mois-ci.");
  });
});
