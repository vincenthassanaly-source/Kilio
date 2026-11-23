import { describe, expect, it } from "vitest";
import { bilanVide, etatSm2, noterEnTete, seanceInitiale } from "./seanceRevision";

describe("noterEnTete", () => {
  it("retire la carte notée et compte une carte faite", () => {
    const etat = noterEnTete(seanceInitiale(["a", "b", "c"]), "bien");
    expect(etat.file).toEqual(["b", "c"]);
    expect(etat.fait).toBe(1);
    expect(etat.bilan.bien).toBe(1);
  });

  it("« À revoir » renvoie la carte en fin de file sans la compter comme faite", () => {
    const etat = noterEnTete(seanceInitiale(["a", "b"]), "a-revoir");
    expect(etat.file).toEqual(["b", "a"]);
    expect(etat.fait).toBe(0);
    expect(etat.bilan["a-revoir"]).toBe(1);
  });

  it("ne modifie pas l'état précédent, gardé pour l'annulation", () => {
    const avant = seanceInitiale(["a", "b"]);
    noterEnTete(avant, "facile");
    expect(avant).toEqual({ file: ["a", "b"], fait: 0, bilan: bilanVide() });
  });

  it("file vide : rien ne change", () => {
    const vide = seanceInitiale([]);
    expect(noterEnTete(vide, "bien")).toBe(vide);
  });
});

describe("etatSm2", () => {
  it("ne garde que les champs de répétition espacée", () => {
    const carte = {
      id: "x",
      question: "q",
      echeance: "2026-11-23T10:00:00.000Z",
      intervalle_jours: 3,
      facilite: 2.5,
      repetitions: 2,
      dernier_passage: null,
    };
    expect(etatSm2(carte)).toEqual({
      echeance: "2026-11-23T10:00:00.000Z",
      intervalle_jours: 3,
      facilite: 2.5,
      repetitions: 2,
      dernier_passage: null,
    });
  });
});
