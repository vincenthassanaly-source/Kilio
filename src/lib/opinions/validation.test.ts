import { describe, expect, it } from "vitest";
import {
  POSITION_MAX,
  champsDepuisLigne,
  champsIdentiques,
  colonnesDepuisChamps,
  scoresVides,
  type ChampsIdee,
} from "./types";
import { nettoyerChamps } from "./validation";

const BASE: ChampsIdee = {
  position: "  Je suis favorable à la retraite à points  ",
  theme: "travail",
  conviction: "plutot",
  arguments_pour: " plus lisible ",
  arguments_contre: "",
  source: "",
  scores: { ...scoresVides(), economique: -1 },
};

describe("nettoyerChamps", () => {
  it("nettoie les textes et conserve scores et thème", () => {
    const resultat = nettoyerChamps(BASE);
    expect(resultat).toMatchObject({
      position: "Je suis favorable à la retraite à points",
      arguments_pour: "plus lisible",
      theme: "travail",
    });
    expect(typeof resultat === "string" ? null : resultat.scores.economique).toBe(-1);
  });

  it("refuse une position vide ou trop longue", () => {
    expect(nettoyerChamps({ ...BASE, position: "   " })).toBe("La position est requise.");
    expect(nettoyerChamps({ ...BASE, position: "x".repeat(POSITION_MAX + 1) })).toMatch(/dépasse/);
  });

  it("refuse un thème, une conviction ou un score hors domaine", () => {
    expect(nettoyerChamps({ ...BASE, theme: "inconnu" as never })).toBe("Thème invalide.");
    expect(nettoyerChamps({ ...BASE, conviction: "tres" as never })).toMatch(/conviction/);
    expect(nettoyerChamps({ ...BASE, scores: { ...scoresVides(), societal: 3 } })).toMatch(/Sociétal/);
    expect(nettoyerChamps({ ...BASE, scores: { ...scoresVides(), societal: 0.5 } })).toMatch(/Sociétal/);
  });

  it("accepte un thème absent et un score neutre", () => {
    const resultat = nettoyerChamps({ ...BASE, theme: null, scores: { ...scoresVides(), ecologie: 0 } });
    expect(typeof resultat).toBe("object");
  });
});

describe("champsDepuisLigne / colonnesDepuisChamps", () => {
  it("fait l'aller-retour et neutralise les valeurs hors domaine", () => {
    const colonnes = colonnesDepuisChamps(BASE);
    expect(champsDepuisLigne(colonnes)).toEqual(BASE);

    const tolerant = champsDepuisLigne({ ...colonnes, theme: "zzz", conviction: "zzz", score_identite: 9 });
    expect(tolerant.theme).toBeNull();
    expect(tolerant.conviction).toBe("plutot");
    expect(tolerant.scores.identite).toBeNull();
  });
});

describe("champsIdentiques", () => {
  it("compare tous les champs, scores compris", () => {
    expect(champsIdentiques(BASE, { ...BASE })).toBe(true);
    expect(champsIdentiques(BASE, { ...BASE, source: "livre" })).toBe(false);
    expect(champsIdentiques(BASE, { ...BASE, scores: { ...BASE.scores, economique: 0 } })).toBe(false);
  });
});
