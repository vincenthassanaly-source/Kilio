import { describe, expect, it } from "vitest";
import {
  dateParis,
  decalageParisMinutes,
  decalerJour,
  instantParis,
  parisMaintenant,
} from "../../../supabase/functions/_shared/paris";

// Les Edge Functions tournent en UTC alors que les réglages sont saisis en heure
// de Paris : ces cas couvrent l'hiver, l'été et le passage à l'heure d'été.
describe("parisMaintenant", () => {
  it("convertit un instant d'hiver (UTC+1)", () => {
    expect(parisMaintenant(Date.UTC(2026, 0, 15, 12, 30))).toEqual({ today: "2026-01-15", minutes: 13 * 60 + 30 });
  });

  it("passe au jour suivant quand l'heure d'été (UTC+2) dépasse minuit", () => {
    expect(parisMaintenant(Date.UTC(2026, 6, 15, 22, 30))).toEqual({ today: "2026-07-16", minutes: 30 });
  });
});

describe("dateParis", () => {
  it("renvoie la date de Paris de l'instant", () => {
    expect(dateParis(Date.UTC(2026, 6, 15, 22, 30))).toBe("2026-07-16");
    expect(dateParis(Date.UTC(2026, 0, 15, 12, 30))).toBe("2026-01-15");
  });
});

describe("decalageParisMinutes", () => {
  it("vaut 60 l'hiver et 120 l'été", () => {
    expect(decalageParisMinutes(Date.UTC(2026, 0, 15, 12, 0))).toBe(60);
    expect(decalageParisMinutes(Date.UTC(2026, 6, 15, 12, 0))).toBe(120);
  });
});

describe("instantParis", () => {
  it("lit une heure murale d'hiver", () => {
    expect(instantParis("2026-01-15", "13:30")).toBe(Date.UTC(2026, 0, 15, 12, 30));
  });

  it("lit une heure murale d'été", () => {
    expect(instantParis("2026-07-15", "14:00:00")).toBe(Date.UTC(2026, 6, 15, 12, 0));
  });

  it("lit une heure qui n'existe pas (02:30 le 29 mars 2026) une heure plus tard", () => {
    // 02:30 saute à 03:30 CEST, soit 01:30 UTC.
    expect(instantParis("2026-03-29", "02:30")).toBe(Date.UTC(2026, 2, 29, 1, 30));
  });
});

describe("decalerJour", () => {
  it("décale d'un nombre de jours calendaires, à travers le changement d'heure", () => {
    expect(decalerJour("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("recule à travers un changement d'année", () => {
    expect(decalerJour("2026-01-01", -1)).toBe("2025-12-31");
  });
});
