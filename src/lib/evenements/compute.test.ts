import { describe, expect, it } from "vitest";
import { calculerHeureFin, dureeEvenement, libellePlage } from "./compute";

describe("calculerHeureFin", () => {
  it("ajoute la durée à l'heure de début", () => {
    expect(calculerHeureFin("14:30", 60)).toBe("15:30");
    expect(calculerHeureFin("09:00", 45)).toBe("09:45");
    expect(calculerHeureFin("08:50", 20)).toBe("09:10");
  });

  it("accepte l'heure Postgres avec secondes", () => {
    expect(calculerHeureFin("14:30:00", 30)).toBe("15:00");
  });

  it("refuse un événement qui déborde sur le lendemain", () => {
    expect(calculerHeureFin("23:30", 60)).toBeNull();
    expect(calculerHeureFin("23:00", 59)).toBe("23:59");
  });

  it("refuse une heure ou une durée invalide", () => {
    expect(calculerHeureFin("25:00", 30)).toBeNull();
    expect(calculerHeureFin("", 30)).toBeNull();
    expect(calculerHeureFin("10:00", 0)).toBeNull();
    expect(calculerHeureFin("10:00", 1.5)).toBeNull();
  });
});

describe("dureeEvenement / libellePlage", () => {
  it("calcule la durée en minutes", () => {
    expect(dureeEvenement("14:30:00", "16:00:00")).toBe(90);
    expect(dureeEvenement("14:30", "14:30")).toBeNull();
    expect(dureeEvenement("15:00", "14:00")).toBeNull();
  });

  it("formate la plage sans secondes", () => {
    expect(libellePlage("14:30:00", "15:30:00")).toBe("14:30 – 15:30");
  });
});
