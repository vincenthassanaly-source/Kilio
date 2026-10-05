import { describe, expect, it } from "vitest";
import { calculerProchaineOccurrence } from "./recurrence";

describe("calculerProchaineOccurrence", () => {
  it("quotidien avance d'un jour", () => {
    expect(calculerProchaineOccurrence("2026-09-24", "quotidien")).toBe("2026-09-25");
  });

  it("hebdomadaire avance de 7 jours", () => {
    expect(calculerProchaineOccurrence("2026-09-24", "hebdomadaire")).toBe("2026-10-01");
  });

  it("mensuel se cale sur le dernier jour du mois cible quand le jour d'origine n'existe pas", () => {
    // 31 janvier + 1 mois -> pas de 31 février, date-fns cale sur le dernier jour (28, 2026 non bissextile)
    expect(calculerProchaineOccurrence("2026-01-31", "mensuel")).toBe("2026-02-28");
  });

  it("annuel gère le 29 février d'une année bissextile vers une année non bissextile", () => {
    expect(calculerProchaineOccurrence("2024-02-29", "annuel")).toBe("2025-02-28");
  });

  it("mensuel franchit correctement un changement d'année", () => {
    expect(calculerProchaineOccurrence("2026-12-15", "mensuel")).toBe("2027-01-15");
  });
});
