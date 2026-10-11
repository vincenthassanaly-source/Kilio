import { describe, expect, it } from "vitest";
import {
  erreurPoseJourLibre,
  jetonsRestants,
  joursLibresDeLaSemaine,
  peutRetirerJourLibre,
  plageJoursLibres,
} from "./libres";

// Semaine du lundi 2026-10-12 au dimanche 2026-10-18.
describe("jetons de la semaine", () => {
  it("ne compte que les jours libres de la semaine concernée", () => {
    const libres = ["2026-10-11", "2026-10-13", "2026-10-19"];
    expect(joursLibresDeLaSemaine(libres, "2026-10-14")).toEqual(["2026-10-13"]);
    expect(jetonsRestants(libres, "2026-10-14")).toBe(1);
    expect(jetonsRestants([], "2026-10-14")).toBe(2);
    expect(jetonsRestants(["2026-10-12", "2026-10-13", "2026-10-14"], "2026-10-14")).toBe(0);
  });
});

describe("erreurPoseJourLibre", () => {
  const today = "2026-10-14";

  it("accepte aujourd'hui et demain", () => {
    expect(erreurPoseJourLibre("2026-10-14", today, [])).toBeNull();
    expect(erreurPoseJourLibre("2026-10-15", today, [])).toBeNull();
  });

  it("refuse hier (après coup) et après-demain", () => {
    expect(erreurPoseJourLibre("2026-10-13", today, [])).toBe("Un jour libre se pose le jour même ou la veille.");
    expect(erreurPoseJourLibre("2026-10-16", today, [])).toBe("Un jour libre se pose le jour même ou la veille.");
  });

  it("refuse un jour déjà libre", () => {
    expect(erreurPoseJourLibre("2026-10-14", today, ["2026-10-14"])).toBe("Ce jour est déjà un jour libre.");
  });

  it("refuse un troisième jeton dans la semaine", () => {
    expect(erreurPoseJourLibre("2026-10-14", today, ["2026-10-12", "2026-10-13"])).toBe(
      "Tu as déjà posé tes 2 jours libres cette semaine."
    );
  });

  it("compte les jetons de la semaine de la date posée, pas de celle d'aujourd'hui", () => {
    // Dimanche : demain est un lundi, donc une semaine neuve avec ses 2 jetons.
    const dimanche = "2026-10-18";
    expect(erreurPoseJourLibre("2026-10-19", dimanche, ["2026-10-16", "2026-10-17"])).toBeNull();
    expect(erreurPoseJourLibre("2026-10-18", dimanche, ["2026-10-16", "2026-10-17"])).toBe(
      "Tu as déjà posé tes 2 jours libres cette semaine."
    );
  });
});

describe("retrait et plage de lecture", () => {
  it("un jour libre se retire tant qu'il n'est pas passé", () => {
    expect(peutRetirerJourLibre("2026-10-14", "2026-10-14")).toBe(true);
    expect(peutRetirerJourLibre("2026-10-15", "2026-10-14")).toBe(true);
    expect(peutRetirerJourLibre("2026-10-13", "2026-10-14")).toBe(false);
  });

  it("la plage couvre la semaine de demain quand elle commence demain", () => {
    expect(plageJoursLibres("2026-10-14")).toEqual({ debut: "2026-10-12", fin: "2026-10-18" });
    expect(plageJoursLibres("2026-10-18")).toEqual({ debut: "2026-10-12", fin: "2026-10-25" });
  });
});
