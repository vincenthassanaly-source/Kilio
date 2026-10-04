import { describe, expect, it } from "vitest";
import { aujourdhuiParis, heureParis, msAvantMinuitParis } from "./paris";

describe("fuseau de Paris", () => {
  it("renvoie le lendemain à Paris quand il est 23 h 30 UTC en hiver", () => {
    const instant = new Date("2026-01-10T23:30:00Z");
    expect(aujourdhuiParis(instant)).toBe("2026-01-11");
    expect(heureParis(instant)).toBe("00:30");
  });

  it("applique l'heure d'été (UTC+2)", () => {
    const instant = new Date("2026-07-10T22:30:00Z");
    expect(aujourdhuiParis(instant)).toBe("2026-07-11");
    expect(heureParis(instant)).toBe("00:30");
  });

  it("compte les ms restantes avant minuit, millisecondes comprises", () => {
    const instant = new Date("2026-01-10T22:59:59.500Z"); // 23:59:59.5 à Paris
    expect(msAvantMinuitParis(instant)).toBe(500);
  });
});
