import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calculerStreak, jourPrecedent } from "./compute";

// Régression : l'ancien code construisait `new Date(`${date}T00:00:00`)`
// (sans `Z`), interprété en heure locale du process. Avec TZ=Europe/Paris
// (UTC+2 en septembre), minuit local converti en UTC retombait sur la
// veille, donc même le jour demandé n'était plus trouvé dans la Map —
// streak cassé dès le premier jour. On force ce fuseau ici pour vérifier
// que le calcul reste correct indépendamment du fuseau du serveur.
describe("calculerStreak (fuseau horaire)", () => {
  const TZ_ORIGINAL = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Paris";
  });

  afterEach(() => {
    process.env.TZ = TZ_ORIGINAL;
  });

  it("compte le jour demandé même quand le serveur tourne en heure de Paris", () => {
    const entries = new Map([
      ["2026-09-24", 1],
      ["2026-09-25", 1],
      ["2026-09-26", 1],
    ]);

    expect(calculerStreak(entries, "2026-09-26")).toBe(3);
  });

  it("s'arrête au premier jour manquant", () => {
    const entries = new Map([
      ["2026-09-25", 1],
      ["2026-09-26", 1],
    ]);

    expect(calculerStreak(entries, "2026-09-26")).toBe(2);
  });

  it("renvoie 0 quand le jour demandé n'a pas d'entrée", () => {
    const entries = new Map([["2026-09-25", 1]]);

    expect(calculerStreak(entries, "2026-09-26")).toBe(0);
  });

  it("jourPrecedent reste correct autour d'un changement de mois", () => {
    expect(jourPrecedent("2026-10-01")).toBe("2026-09-30");
  });
});

import {
  calculerStreakHebdo,
  calculerTauxReussite,
  lundiDe,
  progressionObjectif,
} from "./compute";

const hebdo3 = { type: "boolean" as const, valeur_cible: null, frequence_hebdo: 3 };
const quotidienne = { type: "boolean" as const, valeur_cible: null, frequence_hebdo: null };

describe("lundiDe", () => {
  it("renvoie le lundi de la semaine (dimanche inclus)", () => {
    expect(lundiDe("2026-09-30")).toBe("2026-09-28"); // mercredi
    expect(lundiDe("2026-09-28")).toBe("2026-09-28");
    expect(lundiDe("2026-10-04")).toBe("2026-09-28"); // dimanche
  });
});

describe("calculerStreakHebdo", () => {
  const jours = (...d: string[]) => new Map(d.map((j) => [j, 1]));

  it("compte les semaines consécutives où la fréquence est atteinte", () => {
    const entries = jours(
      "2026-09-14", "2026-09-16", "2026-09-18", // sem. du 14
      "2026-09-21", "2026-09-22", "2026-09-25", // sem. du 21
      "2026-09-28", "2026-09-29", "2026-09-30" // sem. du 28 (en cours, atteinte)
    );
    expect(calculerStreakHebdo(hebdo3, entries, "2026-09-30")).toBe(3);
  });

  it("ne casse pas la série tant que la semaine en cours n'est pas atteinte", () => {
    const entries = jours("2026-09-21", "2026-09-22", "2026-09-25", "2026-09-28");
    expect(calculerStreakHebdo(hebdo3, entries, "2026-09-30")).toBe(1);
  });

  it("s'arrête à la première semaine manquée", () => {
    const entries = jours("2026-09-14", "2026-09-16", "2026-09-18", "2026-09-28", "2026-09-29", "2026-09-30");
    expect(calculerStreakHebdo(hebdo3, entries, "2026-09-30")).toBe(1);
  });

  it("renvoie 0 pour une habitude quotidienne", () => {
    expect(calculerStreakHebdo(quotidienne, jours("2026-09-30"), "2026-09-30")).toBe(0);
  });
});

describe("calculerTauxReussite", () => {
  it("quotidienne : jours faits / jours de la période", () => {
    const entries = new Map([["2026-09-01", 1], ["2026-09-02", 1], ["2026-09-04", 0]]);
    expect(calculerTauxReussite(quotidienne, entries, "2026-09-01", "2026-09-04")).toEqual({
      faits: 2,
      attendus: 4,
    });
  });

  it("hebdo : plafonne les jours faits à la fréquence par semaine", () => {
    const entries = new Map(
      ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"].map((j) => [j, 1] as [string, number])
    );
    const r = calculerTauxReussite(hebdo3, entries, "2026-09-14", "2026-09-20");
    expect(r.faits).toBe(3);
    expect(r.attendus).toBe(3);
  });

  it("quantifiée avec cible : ne compte que si la cible est atteinte", () => {
    const eau = { type: "quantifiee" as const, valeur_cible: 8, frequence_hebdo: null };
    const entries = new Map([["2026-09-01", 8], ["2026-09-02", 5]]);
    expect(calculerTauxReussite(eau, entries, "2026-09-01", "2026-09-02").faits).toBe(1);
  });
});

describe("progressionObjectif", () => {
  const liee = (over: Partial<Parameters<typeof progressionObjectif>[0][number]> = {}) => ({
    ...quotidienne,
    created_at: "2026-09-01T08:00:00Z",
    archivee_le: null,
    entriesParDate: new Map([["2026-09-01", 1], ["2026-09-02", 1]]),
    ...over,
  });

  it("moyenne les taux des habitudes liées", () => {
    const p = progressionObjectif(
      [liee(), liee({ entriesParDate: new Map() })],
      "2026-09-01",
      null,
      "2026-09-04"
    );
    expect(p).toBeCloseTo(0.25); // (2/4 + 0/4) / 2
  });

  it("arrête de compter à l'archivage de l'habitude", () => {
    const p = progressionObjectif([liee({ archivee_le: "2026-09-02" })], "2026-09-01", null, "2026-09-10");
    expect(p).toBe(1);
  });

  it("borne la période à l'échéance passée et renvoie 0 sans habitude", () => {
    expect(progressionObjectif([liee()], "2026-09-01", "2026-09-02", "2026-09-30")).toBe(1);
    expect(progressionObjectif([], "2026-09-01", null, "2026-09-04")).toBe(0);
  });
});
