import { describe, expect, it } from "vitest";
import {
  calculerPropositions,
  formaterDuree,
  formaterHeure,
  heureDepuisMinutes,
  minutesDepuisHeure,
  validerPropositions,
} from "./cycles";

describe("calculerPropositions", () => {
  it("23h42 → 5h57, 7h27 et 8h57 (4, 5 et 6 cycles + 15 min d'endormissement)", () => {
    expect(calculerPropositions("23:42")).toEqual([
      { heure: "05:57", cycles: 4, dureeSommeilMin: 360 },
      { heure: "07:27", cycles: 5, dureeSommeilMin: 450 },
      { heure: "08:57", cycles: 6, dureeSommeilMin: 540 },
    ]);
  });

  it("repasse correctement minuit", () => {
    expect(calculerPropositions("00:00").map((p) => p.heure)).toEqual(["06:15", "07:45", "09:15"]);
  });

  it("rejette une heure invalide", () => {
    expect(() => calculerPropositions("25:00")).toThrow();
  });
});

describe("validerPropositions", () => {
  const juste = {
    propositions: [
      { cycles: 4, heure: "05:57" },
      { cycles: 5, heure: "07:27" },
      { cycles: 6, heure: "08:57" },
    ],
  };

  it("accepte la réponse exacte", () => {
    expect(validerPropositions(juste, "23:42")?.map((p) => p.heure)).toEqual(["05:57", "07:27", "08:57"]);
  });

  it("ignore l'ordre et les propositions en plus", () => {
    const brut = { propositions: [{ cycles: 7, heure: "10:27" }, ...juste.propositions.slice().reverse()] };
    expect(validerPropositions(brut, "23:42")).not.toBeNull();
  });

  it("tolère « 5:57 » et « 05h57 » comme formats d'heure", () => {
    const brut = { propositions: [{ cycles: 4, heure: "5:57" }, { cycles: 5, heure: "07h27" }, { cycles: 6, heure: "08:57" }] };
    expect(validerPropositions(brut, "23:42")).not.toBeNull();
  });

  it("refuse une heure fausse", () => {
    const brut = { propositions: [{ cycles: 4, heure: "05:57" }, { cycles: 5, heure: "07:00" }, { cycles: 6, heure: "08:57" }] };
    expect(validerPropositions(brut, "23:42")).toBeNull();
  });

  it("refuse une proposition manquante", () => {
    expect(validerPropositions({ propositions: juste.propositions.slice(0, 2) }, "23:42")).toBeNull();
  });

  it("refuse une forme inattendue", () => {
    expect(validerPropositions(null, "23:42")).toBeNull();
    expect(validerPropositions({ propositions: "x" }, "23:42")).toBeNull();
    expect(validerPropositions({ propositions: [null, 3] }, "23:42")).toBeNull();
  });
});

describe("formats", () => {
  it("convertit heures et minutes", () => {
    expect(minutesDepuisHeure("06:57")).toBe(417);
    expect(minutesDepuisHeure("6:57")).toBeNull();
    expect(heureDepuisMinutes(-30)).toBe("23:30");
  });

  it("formate pour l'affichage", () => {
    expect(formaterHeure("06:57")).toBe("6h57");
    expect(formaterDuree(450)).toBe("7h30");
    expect(formaterDuree(360)).toBe("6h");
  });
});
