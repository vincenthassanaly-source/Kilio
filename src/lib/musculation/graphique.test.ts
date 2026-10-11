import { describe, expect, it } from "vitest";
import { graduations, positionsX } from "./graphique";

describe("graduations", () => {
  it("encadre les données avec des valeurs rondes", () => {
    const g = graduations([82, 95, 101.3]);
    expect(g.min).toBeLessThanOrEqual(82);
    expect(g.max).toBeGreaterThanOrEqual(101.3);
    expect(g.ticks).toEqual([80, 85, 90, 95, 100, 105]);
    expect([g.min, g.max]).toEqual([80, 105]);
  });

  it("choisit des pas de 1, 2, 2,5, 5 ou 10", () => {
    expect(graduations([0, 10]).ticks).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(graduations([0, 1000]).ticks).toEqual([0, 250, 500, 750, 1000]);
    expect(graduations([100, 160]).ticks).toEqual([100, 120, 140, 160]);
    expect(graduations([0, 3]).ticks).toEqual([0, 1, 2, 3]);
  });

  it("donne une marge à une valeur unique ou répétée", () => {
    const g = graduations([100, 100]);
    expect(g.min).toBeLessThan(100);
    expect(g.max).toBeGreaterThan(100);
    expect(g.ticks).toContain(100);
    expect(graduations([0]).ticks.length).toBeGreaterThan(1);
  });

  it("reste utilisable sans donnée et sans erreur d'arrondi", () => {
    expect(graduations([])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
    expect(graduations([0.1, 0.4]).ticks.every((t) => Number.isFinite(t) && String(t).length < 8)).toBe(true);
  });
});

describe("positionsX", () => {
  it("place les dates proportionnellement au temps", () => {
    expect(positionsX(["2026-10-01", "2026-10-02", "2026-10-11"])).toEqual([0, 0.1, 1]);
  });

  it("centre une date unique ou plusieurs séances le même jour", () => {
    expect(positionsX(["2026-10-01"])).toEqual([0.5]);
    expect(positionsX(["2026-10-01", "2026-10-01"])).toEqual([0.5, 0.5]);
    expect(positionsX([])).toEqual([]);
  });

  it("traverse un changement d'heure sans décalage", () => {
    expect(positionsX(["2026-10-24", "2026-10-25", "2026-10-26"])).toEqual([0, 0.5, 1]);
  });
});
