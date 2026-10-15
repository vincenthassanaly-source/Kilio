import { describe, expect, it } from "vitest";
import { scoreDuJour } from "./score";

const AUCUN = { taches: [], nutrition: null, sport: null, habitudes: null };

describe("scoreDuJour", () => {
  it("renvoie null quand aucun domaine n'a d'objet aujourd'hui", () => {
    expect(scoreDuJour(AUCUN)).toBeNull();
  });

  it("tâches du jour : faites sur total", () => {
    const score = scoreDuJour({ ...AUCUN, taches: [{ fait: true }, { fait: false }, { fait: true }, { fait: false }] });
    expect(score?.pct).toBe(50);
    expect(score?.lignes).toEqual([
      expect.objectContaining({ domaine: "taches", fait: 2, total: 4, detail: "2/4" }),
    ]);
  });

  it("moyenne les domaines à poids égal et arrondit", () => {
    const score = scoreDuJour({
      ...AUCUN,
      taches: [{ fait: true }, { fait: false }, { fait: false }],
      sport: { entraineAujourdhui: true, seancesFaites: 1 },
    });
    // (1/3 + 1) / 2 = 66,7 %
    expect(score?.pct).toBe(67);
    expect(score?.lignes.map((l) => l.domaine)).toEqual(["taches", "sport"]);
  });

  describe("nutrition", () => {
    const nutrition = (kcal: number, kcalGoal: number | null = 2000, jourLibre = false) => ({
      ...AUCUN,
      nutrition: { kcal, kcalGoal, jourLibre },
    });

    it("progresse vers la cible sans la dépasser", () => {
      const score = scoreDuJour(nutrition(1000));
      expect(score?.pct).toBe(50);
      expect(score?.lignes[0].detail).toBe("1000 / 2000 kcal");
    });

    it("atteint 100 % jusqu'à +10 % de la cible", () => {
      expect(scoreDuJour(nutrition(2000))?.pct).toBe(100);
      expect(scoreDuJour(nutrition(2200))?.pct).toBe(100);
    });

    it("redescend au-delà de +10 % et ne passe jamais sous 0", () => {
      expect(scoreDuJour(nutrition(2400))?.pct).toBe(50);
      expect(scoreDuJour(nutrition(5000))?.pct).toBe(0);
    });

    it("est exclue : journal vide, jour libre, ou aucune cible", () => {
      expect(scoreDuJour(nutrition(0))).toBeNull();
      expect(scoreDuJour(nutrition(1500, 2000, true))).toBeNull();
      expect(scoreDuJour(nutrition(1500, null))).toBeNull();
      expect(scoreDuJour(nutrition(1500, 0))).toBeNull();
    });
  });

  describe("sport", () => {
    it("est exclu un jour de repos sans séance", () => {
      expect(scoreDuJour({ ...AUCUN, sport: { entraineAujourdhui: false, seancesFaites: 0 } })).toBeNull();
    });

    it("compte 0 % un jour d'entraînement sans séance enregistrée", () => {
      const score = scoreDuJour({ ...AUCUN, sport: { entraineAujourdhui: true, seancesFaites: 0 } });
      expect(score?.pct).toBe(0);
      expect(score?.lignes[0].detail).toBe("Journée d'entraînement");
    });

    it("compte 100 % dès qu'une séance est faite, même un jour de repos", () => {
      const score = scoreDuJour({ ...AUCUN, sport: { entraineAujourdhui: false, seancesFaites: 1 } });
      expect(score?.pct).toBe(100);
      expect(score?.lignes[0].detail).toBe("Séance faite");
    });
  });

  describe("habitudes", () => {
    it("est exclue sans habitude active", () => {
      expect(scoreDuJour({ ...AUCUN, habitudes: [] })).toBeNull();
    });

    it("compte les habitudes quotidiennes faites sur total", () => {
      const score = scoreDuJour({
        ...AUCUN,
        habitudes: [
          { fait: true, hebdo: false },
          { fait: false, hebdo: false },
        ],
      });
      expect(score?.pct).toBe(50);
      expect(score?.lignes[0]).toEqual(expect.objectContaining({ fait: 1, total: 2, detail: "1/2" }));
    });

    it("n'attend pas une habitude hebdomadaire un jour où elle n'est pas faite, mais la compte si elle l'est", () => {
      const pasFaite = scoreDuJour({
        ...AUCUN,
        habitudes: [
          { fait: true, hebdo: false },
          { fait: false, hebdo: true },
        ],
      });
      expect(pasFaite?.lignes[0]).toEqual(expect.objectContaining({ fait: 1, total: 1 }));

      const faite = scoreDuJour({ ...AUCUN, habitudes: [{ fait: true, hebdo: true }] });
      expect(faite?.lignes[0]).toEqual(expect.objectContaining({ fait: 1, total: 1 }));
    });
  });

  it("ordonne les lignes : tâches, nutrition, sport, habitudes", () => {
    const score = scoreDuJour({
      habitudes: [{ fait: true, hebdo: false }],
      sport: { entraineAujourdhui: true, seancesFaites: 1 },
      nutrition: { kcal: 1000, kcalGoal: 2000, jourLibre: false },
      taches: [{ fait: true }],
    });
    expect(score?.lignes.map((l) => l.domaine)).toEqual(["taches", "nutrition", "sport", "habitudes"]);
  });
});
