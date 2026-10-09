import { describe, expect, it } from "vitest";
import { datesDansPlage, etendreOccurrences, evenementsHoraires, evenementsJourneeEntiere } from "./compute";

const base = { date: "2026-01-31", recurrence_frequence: null, recurrence_fin: null } as const;

describe("datesDansPlage", () => {
  it("événement simple : sa date si dans la plage", () => {
    expect(datesDansPlage(base, "2026-01-01", "2026-01-31")).toEqual(["2026-01-31"]);
    expect(datesDansPlage(base, "2026-02-01", "2026-02-28")).toEqual([]);
  });
  it("hebdomadaire : une date par semaine, bornée par la fin", () => {
    const e = { date: "2026-10-01", recurrence_frequence: "hebdomadaire", recurrence_fin: "2026-10-15" } as const;
    expect(datesDansPlage(e, "2026-10-01", "2026-12-31")).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
  });
  it("ne renvoie pas les occurrences antérieures à la plage", () => {
    const e = { date: "2026-10-01", recurrence_frequence: "quotidien", recurrence_fin: null } as const;
    expect(datesDansPlage(e, "2026-10-03", "2026-10-05")).toEqual(["2026-10-03", "2026-10-04", "2026-10-05"]);
  });
  it("mensuel : cale sur le dernier jour sans dériver", () => {
    const e = { date: "2026-01-31", recurrence_frequence: "mensuel", recurrence_fin: null } as const;
    expect(datesDansPlage(e, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("annuel : 29 février → 28 février en année non bissextile", () => {
    const e = { date: "2028-02-29", recurrence_frequence: "annuel", recurrence_fin: null } as const;
    expect(datesDansPlage(e, "2028-01-01", "2029-12-31")).toEqual(["2028-02-29", "2029-02-28"]);
  });
});

describe("etendreOccurrences", () => {
  it("conserve la date d'origine de la série", () => {
    const e = { id: "a", date: "2026-10-01", recurrence_frequence: "hebdomadaire", recurrence_fin: null } as const;
    const occ = etendreOccurrences([e], "2026-10-07", "2026-10-09");
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ id: "a", date: "2026-10-08", dateOrigine: "2026-10-01" });
  });
});

describe("journée entière", () => {
  it("sépare horaires et journée entière", () => {
    const l = [{ toute_la_journee: true }, { toute_la_journee: false }];
    expect(evenementsHoraires(l)).toHaveLength(1);
    expect(evenementsJourneeEntiere(l)).toHaveLength(1);
  });
});
