import { describe, expect, it } from "vitest";
import { heureAvantGrille, pxToMinutes, getTacheBlockStyle } from "./TimeGrid";
import { majusculePremiere } from "./date-utils";

describe("heureAvantGrille", () => {
  it("détecte les heures avant 06h, y compris au format HH:MM:SS", () => {
    expect(heureAvantGrille("05:30")).toBe(true);
    expect(heureAvantGrille("00:00:00")).toBe(true);
    expect(heureAvantGrille("05:59:00")).toBe(true);
  });

  it("laisse dans la grille 06h et au-delà", () => {
    expect(heureAvantGrille("06:00")).toBe(false);
    expect(heureAvantGrille("14:15:00")).toBe(false);
  });

  it("ne classe pas hors grille une heure absente", () => {
    expect(heureAvantGrille(null)).toBe(false);
  });
});

describe("pxToMinutes", () => {
  it("est l'inverse de la position d'un bloc dans la grille", () => {
    for (const zoom of [0.5, 1, 1.6]) {
      for (const heure of ["06:00", "09:30", "18:45"]) {
        const style = getTacheBlockStyle({ heure, heure_fin: null }, zoom);
        const [h, m] = heure.split(":").map(Number);
        expect(style).not.toBeNull();
        expect(pxToMinutes(style!.top, zoom)).toBeCloseTo(h * 60 + m, 5);
      }
    }
  });
});

describe("majusculePremiere", () => {
  it("ne met en majuscule que la première lettre", () => {
    expect(majusculePremiere("lundi 10 novembre")).toBe("Lundi 10 novembre");
  });

  it("accepte la chaîne vide", () => {
    expect(majusculePremiere("")).toBe("");
  });
});
