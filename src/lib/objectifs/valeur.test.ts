import { describe, expect, it } from "vitest";
import { moyenneGlissante, progressionValeur } from "./valeur";

describe("progressionValeur", () => {
  it("null sans cible", () => {
    expect(progressionValeur([80], null)).toBeNull();
  });

  it("0 sans aucune mesure", () => {
    expect(progressionValeur([], 70)).toBe(0);
  });

  it("perte de poids : part de la 1ère mesure, pas de zéro", () => {
    // 80 → 75 sur une cible de 70 : la moitié du chemin
    expect(progressionValeur([80, 78, 75], 70)).toBeCloseTo(0.5);
  });

  it("perte de poids : 0 à la 1ère mesure, 1 une fois la cible atteinte ou dépassée", () => {
    expect(progressionValeur([80], 70)).toBe(0);
    expect(progressionValeur([80, 70], 70)).toBe(1);
    expect(progressionValeur([80, 68], 70)).toBe(1);
  });

  it("perte de poids : reprise de poids au-dessus du départ = 0, jamais négatif", () => {
    expect(progressionValeur([80, 83], 70)).toBe(0);
  });

  it("valeur cumulée : garde actuel / cible (départ à zéro)", () => {
    expect(progressionValeur([2, 5], 20)).toBeCloseTo(0.25);
    expect(progressionValeur([2, 25], 20)).toBe(1);
  });

  it("1ère mesure déjà au-dessus de la cible = objectif à faire baisser (0 %)", () => {
    expect(progressionValeur([30], 20)).toBe(0);
  });
});

describe("moyenneGlissante", () => {
  it("moyenne des points de la fenêtre de 7 jours calendaires", () => {
    const points = [
      { date: "2026-09-01", valeur: 80 },
      { date: "2026-09-02", valeur: 82 },
      { date: "2026-09-03", valeur: 78 },
    ];
    expect(moyenneGlissante(points)).toEqual([80, 81, 80]);
  });

  it("exclut un point vieux de 7 jours (hors fenêtre)", () => {
    const points = [
      { date: "2026-09-01", valeur: 100 },
      { date: "2026-09-08", valeur: 80 },
    ];
    expect(moyenneGlissante(points)).toEqual([100, 80]);
  });

  it("inclut le point d'il y a 6 jours", () => {
    const points = [
      { date: "2026-09-01", valeur: 100 },
      { date: "2026-09-07", valeur: 80 },
    ];
    expect(moyenneGlissante(points)).toEqual([100, 90]);
  });

  it("liste vide", () => {
    expect(moyenneGlissante([])).toEqual([]);
  });
});
