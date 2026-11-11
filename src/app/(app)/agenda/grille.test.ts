import { describe, expect, it } from "vitest";
import { computeInitialScrollTop, heureAvantGrille, pxToMinutes, getTacheBlockStyle } from "./TimeGrid";
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

describe("computeInitialScrollTop", () => {
  const MIN = (h: number, m = 0) => h * 60 + m;

  it("sans bloc : l'heure visée moins la marge, jamais négatif", () => {
    const haut = computeInitialScrollTop(MIN(10, 50), 1);
    expect(haut).toBeGreaterThan(0);
    expect(computeInitialScrollTop(MIN(6), 1)).toBe(0);
  });

  it("remonte au début d'un bloc que le bord haut couperait", () => {
    const sansBloc = computeInitialScrollTop(MIN(10, 50), 1);
    const bloc = { start: MIN(9), end: MIN(10) };
    const avecBloc = computeInitialScrollTop(MIN(10, 50), 1, [bloc]);
    const topBloc = getTacheBlockStyle({ heure: "09:00", heure_fin: "10:00" }, 1)!.top;
    expect(avecBloc).toBeLessThan(sansBloc);
    // Le haut de la fenêtre tombe juste au-dessus du bloc : son étiquette d'heure reste visible.
    expect(avecBloc).toBeLessThanOrEqual(topBloc);
    expect(topBloc - avecBloc).toBeLessThan(20);
  });

  it("ne bouge pas si aucun bloc n'est coupé", () => {
    const sansBloc = computeInitialScrollTop(MIN(10, 50), 1);
    const loin = { start: MIN(7), end: MIN(8) };
    expect(computeInitialScrollTop(MIN(10, 50), 1, [loin])).toBe(sansBloc);
  });

  it("garde le repère maintenant visible face à un bloc très long", () => {
    const sansBloc = computeInitialScrollTop(MIN(16), 1);
    const journeeLongue = { start: MIN(7), end: MIN(18) };
    expect(computeInitialScrollTop(MIN(16), 1, [journeeLongue])).toBe(sansBloc);
  });

  it("enchaîne les blocs qui se chevauchent", () => {
    const a = { start: MIN(9), end: MIN(10) };
    const b = { start: MIN(8, 30), end: MIN(9, 30) };
    const haut = computeInitialScrollTop(MIN(10, 50), 1, [a, b]);
    const topB = getTacheBlockStyle({ heure: "08:30", heure_fin: "09:30" }, 1)!.top;
    expect(haut).toBeLessThanOrEqual(topB);
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
