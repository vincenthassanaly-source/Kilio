import { describe, expect, it } from "vitest";
import { estJourValide, estMoisValide, premierEtDernierJour } from "./jours";

const MAINTENANT = new Date("2026-10-19T20:00:00Z"); // 22 h à Paris, le 19

describe("estJourValide", () => {
  it("accepte aujourd'hui et un jour passé", () => {
    expect(estJourValide("2026-10-19", MAINTENANT)).toBe(true);
    expect(estJourValide("2025-01-31", MAINTENANT)).toBe(true);
  });

  it("tolère un jour d'avance (décalage d'horloge du téléphone)", () => {
    expect(estJourValide("2026-10-20", MAINTENANT)).toBe(true);
  });

  it("refuse le futur lointain", () => {
    expect(estJourValide("2026-10-22", MAINTENANT)).toBe(false);
  });

  it("refuse un format ou une date impossible", () => {
    expect(estJourValide("19/10/2026", MAINTENANT)).toBe(false);
    expect(estJourValide("2026-02-30", MAINTENANT)).toBe(false);
    expect(estJourValide("2026-13-01", MAINTENANT)).toBe(false);
    expect(estJourValide("", MAINTENANT)).toBe(false);
  });
});

describe("estMoisValide", () => {
  it("n'accepte que AAAA-MM", () => {
    expect(estMoisValide("2026-10")).toBe(true);
    expect(estMoisValide("2026-13")).toBe(false);
    expect(estMoisValide("2026-1")).toBe(false);
    expect(estMoisValide("2026-10-01")).toBe(false);
  });
});

describe("premierEtDernierJour", () => {
  it("borne un mois de 31 jours, un février bissextile et décembre", () => {
    expect(premierEtDernierJour("2026-10")).toEqual(["2026-10-01", "2026-10-31"]);
    expect(premierEtDernierJour("2028-02")).toEqual(["2028-02-01", "2028-02-29"]);
    expect(premierEtDernierJour("2026-12")).toEqual(["2026-12-01", "2026-12-31"]);
  });
});
