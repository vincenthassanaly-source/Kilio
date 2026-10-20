import { describe, expect, it } from "vitest";
import {
  HAUTEUR_MIN,
  MAX_POINTS_PAR_TRAIT,
  MAX_TRAITS,
  compterPoints,
  creerTrait,
  hauteurRequise,
  intersecteBande,
  simplifier,
  traitsTouches,
  validerFeuille,
  type Trait,
} from "./traits";

describe("creerTrait", () => {
  it("arrondit les coordonnées et borne la pression entre 0 et 100", () => {
    const trait = creerTrait(2, [
      { x: 10.4, y: 20.6, pression: 0.5 },
      { x: 80, y: 90, pression: 3 },
    ]);
    expect(trait.e).toBe(2);
    expect(trait.p).toEqual([10, 21, 50, 80, 90, 100]);
  });

  it("duplique un point isolé pour qu'un tap laisse un point visible", () => {
    const trait = creerTrait(1, [{ x: 5, y: 6, pression: 0.4 }]);
    expect(trait.p).toEqual([5, 6, 40, 5, 6, 40]);
  });

  it("supprime les points consécutifs identiques", () => {
    const trait = creerTrait(1, [
      { x: 1, y: 1, pression: 0.5 },
      { x: 1.2, y: 0.9, pression: 0.5 },
      { x: 50, y: 50, pression: 0.5 },
    ]);
    expect(trait.p).toEqual([1, 1, 50, 50, 50, 50]);
  });
});

describe("simplifier", () => {
  it("retire les points alignés en gardant les extrémités", () => {
    const p = [0, 0, 50, 10, 0, 50, 20, 0, 50, 30, 0, 50];
    expect(simplifier(p, 1)).toEqual([0, 0, 50, 30, 0, 50]);
  });

  it("garde un coin franc", () => {
    const p = [0, 0, 50, 50, 0, 50, 50, 50, 50];
    expect(simplifier(p, 1)).toEqual(p);
  });

  it("ne touche pas un trait de deux points", () => {
    const p = [0, 0, 50, 9, 9, 50];
    expect(simplifier(p, 1)).toEqual(p);
  });
});

describe("traitsTouches", () => {
  const trait: Trait = { e: 1, p: [0, 100, 50, 200, 100, 50] };

  it("trouve un trait traversé par la gomme", () => {
    expect(traitsTouches([trait], 100, 104, 6)).toEqual([0]);
  });

  it("ignore un trait trop éloigné", () => {
    expect(traitsTouches([trait], 100, 200, 6)).toEqual([]);
  });

  it("gère un trait réduit à un point", () => {
    const point: Trait = { e: 1, p: [50, 50, 50, 50, 50, 50] };
    expect(traitsTouches([point], 52, 51, 5)).toEqual([0]);
  });
});

describe("intersecteBande", () => {
  const trait: Trait = { e: 1, p: [0, 100, 50, 10, 300, 50] };

  it("détecte un trait qui traverse la bande sans avoir de point dedans", () => {
    expect(intersecteBande(trait, 150, 250)).toBe(true);
  });

  it("ignore un trait entièrement au-dessus ou en dessous", () => {
    expect(intersecteBande(trait, 400, 500)).toBe(false);
    expect(intersecteBande(trait, 0, 50)).toBe(false);
  });

  it("garde une marge égale à l'épaisseur du trait", () => {
    const epais: Trait = { e: 3, p: [0, 100, 50, 10, 100, 50] };
    expect(intersecteBande(epais, 102, 200)).toBe(true);
  });
});

describe("hauteurRequise", () => {
  it("garde la hauteur minimale pour une feuille vide", () => {
    expect(hauteurRequise([])).toBe(HAUTEUR_MIN);
  });

  it("agrandit la feuille d'un écran sous le trait le plus bas", () => {
    const bas: Trait = { e: 1, p: [0, HAUTEUR_MIN - 100, 50, 10, HAUTEUR_MIN - 100, 50] };
    expect(hauteurRequise([bas])).toBeGreaterThan(HAUTEUR_MIN);
  });
});

describe("compterPoints", () => {
  it("compte les points, pas les nombres", () => {
    expect(compterPoints([{ e: 1, p: [0, 0, 50, 1, 1, 50] }])).toBe(2);
  });
});

describe("validerFeuille", () => {
  const trait: Trait = { e: 2, p: [0, 0, 50, 10, 10, 50] };

  it("accepte une feuille valide", () => {
    const r = validerFeuille({ traits: [trait], hauteur: 2500 });
    expect(r).toEqual({ ok: true, traits: [trait], hauteur: 2500 });
  });

  it("refuse une épaisseur inconnue", () => {
    expect(validerFeuille({ traits: [{ e: 9, p: [0, 0, 50, 1, 1, 50] }], hauteur: 2000 }).ok).toBe(false);
  });

  it("refuse un tableau de points dont la longueur n'est pas multiple de 3", () => {
    expect(validerFeuille({ traits: [{ e: 1, p: [0, 0, 50, 1] }], hauteur: 2000 }).ok).toBe(false);
  });

  it("refuse des valeurs non entières ou hors bornes", () => {
    expect(validerFeuille({ traits: [{ e: 1, p: [0.5, 0, 50, 1, 1, 50] }], hauteur: 2000 }).ok).toBe(false);
    expect(validerFeuille({ traits: [{ e: 1, p: [5000, 0, 50, 1, 1, 50] }], hauteur: 2000 }).ok).toBe(false);
    expect(validerFeuille({ traits: [{ e: 1, p: [0, 0, 200, 1, 1, 50] }], hauteur: 2000 }).ok).toBe(false);
  });

  it("refuse une hauteur aberrante", () => {
    expect(validerFeuille({ traits: [], hauteur: -1 }).ok).toBe(false);
    expect(validerFeuille({ traits: [], hauteur: 10_000_000 }).ok).toBe(false);
  });

  it("refuse trop de traits ou trop de points par trait", () => {
    expect(validerFeuille({ traits: Array.from({ length: MAX_TRAITS + 1 }, () => trait), hauteur: 2000 }).ok).toBe(false);
    const long = { e: 1, p: Array.from({ length: (MAX_POINTS_PAR_TRAIT + 1) * 3 }, () => 1) };
    expect(validerFeuille({ traits: [long], hauteur: 2000 }).ok).toBe(false);
  });

  it("refuse une entrée qui n'est pas un objet", () => {
    expect(validerFeuille(null).ok).toBe(false);
    expect(validerFeuille({ traits: "x", hauteur: 2000 }).ok).toBe(false);
  });
});
