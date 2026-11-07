import { describe, expect, it } from "vitest";
import { barreBasseMasquee } from "./immersif";

describe("barreBasseMasquee", () => {
  it("masque la barre du bas sur la séance en direct, avec ou sans slash final", () => {
    expect(barreBasseMasquee("/musculation/seance")).toBe(true);
    expect(barreBasseMasquee("/musculation/seance/")).toBe(true);
  });

  it("masque la barre sur la feuille du soir et sur celle d'un autre jour, mais pas sur le calendrier", () => {
    expect(barreBasseMasquee("/journal")).toBe(true);
    expect(barreBasseMasquee("/journal/2026-10-12")).toBe(true);
    expect(barreBasseMasquee("/journal/calendrier")).toBe(false);
  });

  it("la garde partout ailleurs, y compris dans le reste du module", () => {
    for (const chemin of ["/", "/musculation", "/musculation/historique", "/musculation/routines/abc", "/musculation/stats", "/plus"]) {
      expect(barreBasseMasquee(chemin)).toBe(false);
    }
  });
});
