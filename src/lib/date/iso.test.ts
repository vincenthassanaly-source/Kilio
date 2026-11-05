import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import { parseISODate, shiftDate, toISODate } from "./iso";

// toISODate n'importe plus date-fns (iso.ts est atteint par le layout de
// toutes les pages) : il doit rester strictement équivalent à
// `format(date, "yyyy-MM-dd")`, qu'il remplace.
describe("toISODate", () => {
  it("donne le même résultat que format(date, 'yyyy-MM-dd') sur chaque jour de 2023 à 2027", () => {
    const debut = new Date(2023, 0, 1, 0, 0, 0);
    for (let i = 0; i < 365 * 5 + 2; i++) {
      const jour = new Date(debut);
      jour.setDate(debut.getDate() + i);
      // Minuit, midi et fin de journée : l'heure locale ne doit pas déborder.
      for (const heure of [0, 12, 23]) {
        jour.setHours(heure, heure === 23 ? 59 : 0, 59, 999);
        expect(toISODate(jour)).toBe(format(jour, "yyyy-MM-dd"));
      }
    }
  });

  it("reste équivalent autour des changements d'heure et pour les années atypiques", () => {
    const cas = [
      new Date(2026, 2, 29, 1, 30), // passage à l'heure d'été (Europe)
      new Date(2026, 2, 29, 3, 30),
      new Date(2026, 9, 25, 2, 30), // retour à l'heure d'hiver
      new Date(2024, 1, 29), // 29 février
      new Date(999, 11, 31),
      new Date(12, 5, 15), // interprété comme 1912 par le constructeur
      new Date(10000, 0, 1),
      new Date(Date.UTC(2026, 10, 4, 23, 30)), // tard le soir en UTC
    ];
    const anneeUn = new Date(2000, 0, 1);
    anneeUn.setFullYear(1);
    const anneeZero = new Date(2000, 0, 1);
    anneeZero.setFullYear(0);
    const anneeNegative = new Date(2000, 0, 1);
    anneeNegative.setFullYear(-44);
    for (const date of [...cas, anneeUn, anneeZero, anneeNegative]) {
      expect(toISODate(date)).toBe(format(date, "yyyy-MM-dd"));
    }
  });

  it("lève la même RangeError que date-fns sur une date invalide", () => {
    const invalide = new Date("pas une date");
    expect(() => format(invalide, "yyyy-MM-dd")).toThrow(RangeError);
    expect(() => toISODate(invalide)).toThrow(new RangeError("Invalid time value"));
  });

  it("fait l'aller-retour avec parseISODate et reste cohérent avec shiftDate", () => {
    for (const iso of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-12-31", "2024-02-29"]) {
      const date = parseISODate(iso);
      expect(toISODate(date)).toBe(iso);
      const lendemain = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      expect(shiftDate(iso, 1)).toBe(toISODate(lendemain));
    }
  });
});
