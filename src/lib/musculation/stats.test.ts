import { describe, expect, it } from "vitest";
import {
  bornesPeriode,
  calculerRecords,
  e1rm,
  joursDePeriode,
  libelleRecords,
  progression,
  recordsBattus,
  resumerPeriode,
  statsExercice,
  type SerieHistorique,
} from "./stats";

const serie = (extra: Partial<SerieHistorique> & { entrainementId: string; date: string }): SerieHistorique => ({
  debutA: `${extra.date}T10:00:00.000Z`,
  exerciceId: "exo",
  type: "normale",
  poids: null,
  reps: null,
  duree: null,
  distance: null,
  ...extra,
});

const historique: SerieHistorique[] = [
  serie({ entrainementId: "e1", date: "2026-10-01", poids: 80, reps: 8 }),
  serie({ entrainementId: "e1", date: "2026-10-01", poids: 40, reps: 10, type: "echauffement" }),
  serie({ entrainementId: "e1", date: "2026-10-01", poids: 85, reps: 5 }),
  serie({ entrainementId: "e2", date: "2026-10-08", poids: 85, reps: 6 }),
  serie({ entrainementId: "e2", date: "2026-10-08", poids: 90, reps: 3 }),
];

describe("e1rm (Epley)", () => {
  it("estime à partir de la charge et des répétitions", () => {
    expect(e1rm(80, 8)).toBe(101.3);
    expect(e1rm(100, 1)).toBe(103.3);
  });

  it("n'estime pas sans charge ni hors de 1 à 12 répétitions", () => {
    expect(e1rm(null, 5)).toBeNull();
    expect(e1rm(80, null)).toBeNull();
    expect(e1rm(0, 5)).toBeNull();
    expect(e1rm(-20, 5)).toBeNull();
    expect(e1rm(80, 0)).toBeNull();
    expect(e1rm(80, 13)).toBeNull();
    expect(e1rm(80, 12)).toBe(112);
  });
});

describe("calculerRecords", () => {
  it("retient les meilleures valeurs et la date de première réalisation, hors échauffement", () => {
    const r = calculerRecords(historique);
    expect(r.poidsMax).toEqual({ valeur: 90, date: "2026-10-08" });
    // 85 × 6 → 102 ; 90 × 3 → 99 ; 80 × 8 → 101.3 : le meilleur est 85 × 6.
    expect(r.e1rmMax).toEqual({ valeur: 102, date: "2026-10-08" });
    expect(r.volumeSerieMax).toEqual({ valeur: 640, date: "2026-10-01" });
    // Séance 1 : 640 + 425 ; séance 2 : 510 + 270 = 780 ; l'échauffement ne compte pas.
    expect(r.volumeSeanceMax).toEqual({ valeur: 1065, date: "2026-10-01" });
    expect(r.repsMax).toEqual({ valeur: 8, date: "2026-10-01" });
    expect(r.dureeMax).toBeNull();
  });

  it("garde la première date quand une valeur est égalée", () => {
    const r = calculerRecords([
      serie({ entrainementId: "a", date: "2026-10-01", poids: 100, reps: 5 }),
      serie({ entrainementId: "b", date: "2026-10-09", poids: 100, reps: 5 }),
    ]);
    expect(r.poidsMax).toEqual({ valeur: 100, date: "2026-10-01" });
  });

  it("gère durée, distance et poids du corps sans charge", () => {
    const r = calculerRecords([
      serie({ entrainementId: "a", date: "2026-10-01", duree: 60, distance: 500 }),
      serie({ entrainementId: "a", date: "2026-10-01", reps: 12, poids: -20 }),
    ]);
    expect(r.dureeMax?.valeur).toBe(60);
    expect(r.distanceMax?.valeur).toBe(500);
    expect(r.repsMax?.valeur).toBe(12);
    expect(r.poidsMax).toBeNull();
    expect(r.volumeSerieMax).toBeNull();
  });

  it("renvoie des records vides sans série", () => {
    expect(Object.values(calculerRecords([])).every((v) => v === null)).toBe(true);
  });
});

describe("progression", () => {
  it("donne une valeur par séance, du plus ancien au plus récent", () => {
    expect(progression(historique, "poids").map((p) => [p.date, p.valeur])).toEqual([
      ["2026-10-01", 85],
      ["2026-10-08", 90],
    ]);
    expect(progression(historique, "e1rm").map((p) => p.valeur)).toEqual([101.3, 102]);
  });

  it("additionne le tonnage de la séance", () => {
    expect(progression(historique, "volume").map((p) => p.valeur)).toEqual([1065, 780]);
  });

  it("omet les séances sans valeur pour la métrique et ignore l'échauffement", () => {
    const series = [
      serie({ entrainementId: "a", date: "2026-10-01", duree: 30 }),
      serie({ entrainementId: "b", date: "2026-10-02", poids: 50, reps: 5, type: "echauffement" }),
    ];
    expect(progression(series, "poids")).toEqual([]);
    expect(progression([], "e1rm")).toEqual([]);
  });
});

describe("recordsBattus", () => {
  const baseline = calculerRecords(historique);
  const s = (poids: number, reps: number, type: "normale" | "echauffement" = "normale") => ({
    type,
    poids,
    reps,
    duree: null,
    distance: null,
  });

  it("signale une série qui dépasse strictement le record connu", () => {
    const [a, b] = recordsBattus([s(92, 3), s(90, 3)], baseline);
    expect(a).toEqual(expect.arrayContaining(["poids"]));
    // La seconde série n'égale que le nouveau record de la séance : rien à signaler.
    expect(b).not.toContain("poids");
  });

  it("n'accorde rien à l'égalité, aux échauffements ni à une série plus légère", () => {
    expect(recordsBattus([s(90, 1)], baseline)[0]).not.toContain("poids");
    expect(recordsBattus([s(200, 10, "echauffement")], baseline)).toEqual([[]]);
    expect(recordsBattus([s(60, 5)], baseline)).toEqual([[]]);
  });

  it("suit les records au fil de la séance", () => {
    const [premiere, seconde] = recordsBattus([s(92, 3), s(94, 3)], baseline);
    expect(premiere).toContain("poids");
    expect(seconde).toContain("poids");
  });

  it("ne signale rien la toute première fois (aucun record antérieur)", () => {
    expect(recordsBattus([s(100, 5), s(105, 5)], null)).toEqual([[], []]);
    expect(recordsBattus([s(100, 5)], calculerRecords([]))).toEqual([[]]);
  });

  it("ne signale que les types qui avaient un record", () => {
    const seulementDuree = calculerRecords([serie({ entrainementId: "a", date: "2026-10-01", duree: 30 })]);
    expect(recordsBattus([s(100, 5)], seulementDuree)).toEqual([[]]);
    expect(recordsBattus([{ type: "normale", poids: null, reps: null, duree: 45, distance: null }], seulementDuree)).toEqual([["duree"]]);
  });
});

describe("resumerPeriode", () => {
  it("totalise séances, séries de travail, volume et répartition par muscle", () => {
    const r = resumerPeriode(
      [
        { id: "e1", date: "2026-10-01", dureeS: 3600 },
        { id: "e2", date: "2026-10-01", dureeS: 1800 },
        { id: "e3", date: "2026-10-03", dureeS: 600 },
      ],
      [
        { entrainementId: "e1", muscle: "pectoraux", type: "normale", poids: 80, reps: 8 },
        { entrainementId: "e1", muscle: "pectoraux", type: "normale", poids: 80, reps: 8 },
        { entrainementId: "e1", muscle: "dos", type: "echauffement", poids: 40, reps: 10 },
        { entrainementId: "e2", muscle: "dos", type: "normale", poids: 60, reps: 10 },
        { entrainementId: "e3", muscle: "biceps", type: "normale", poids: -10, reps: 10 },
      ],
    );
    expect(r).toEqual({
      nbSeances: 3,
      dureeS: 6000,
      nbSeries: 4,
      volume: 1880,
      jours: ["2026-10-01", "2026-10-03"],
      parMuscle: [
        { muscle: "pectoraux", nbSeries: 2 },
        { muscle: "biceps", nbSeries: 1 },
        { muscle: "dos", nbSeries: 1 },
      ],
    });
  });

  it("renvoie un résumé vide sans donnée", () => {
    expect(resumerPeriode([], [])).toEqual({ nbSeances: 0, dureeS: 0, nbSeries: 0, volume: 0, jours: [], parMuscle: [] });
  });
});

describe("bornesPeriode et joursDePeriode", () => {
  it("calcule la semaine (lundi → dimanche) et le mois, avec décalage", () => {
    // 2026-10-14 est un mercredi.
    expect(bornesPeriode("semaine", "2026-10-14")).toEqual({ debut: "2026-10-12", fin: "2026-10-18" });
    expect(bornesPeriode("semaine", "2026-10-18")).toEqual({ debut: "2026-10-12", fin: "2026-10-18" });
    expect(bornesPeriode("semaine", "2026-10-11")).toEqual({ debut: "2026-10-05", fin: "2026-10-11" });
    expect(bornesPeriode("semaine", "2026-10-14", -1)).toEqual({ debut: "2026-10-05", fin: "2026-10-11" });
    expect(bornesPeriode("mois", "2026-10-14")).toEqual({ debut: "2026-10-01", fin: "2026-10-31" });
    expect(bornesPeriode("mois", "2026-10-14", -1)).toEqual({ debut: "2026-09-01", fin: "2026-09-30" });
    expect(bornesPeriode("mois", "2026-01-31", -1)).toEqual({ debut: "2025-12-01", fin: "2025-12-31" });
    expect(bornesPeriode("mois", "2026-02-10")).toEqual({ debut: "2026-02-01", fin: "2026-02-28" });
  });

  it("refuse une date invalide", () => {
    expect(() => bornesPeriode("mois", "demain")).toThrow();
  });

  it("liste les jours d'une période, bornes comprises", () => {
    expect(joursDePeriode("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(joursDePeriode("2026-10-12", "2026-10-11")).toEqual([]);
  });
});

describe("statsExercice", () => {
  it("rassemble séances, records et les trois courbes", () => {
    const stats = statsExercice(historique);
    expect(stats.nbSeances).toBe(2);
    expect(stats.records.poidsMax?.valeur).toBe(90);
    expect(stats.progression.poids).toHaveLength(2);
    expect(stats.progression.e1rm).toHaveLength(2);
    expect(stats.progression.volume).toHaveLength(2);
  });

  it("est vide sans série", () => {
    expect(statsExercice([]).nbSeances).toBe(0);
    expect(statsExercice([]).progression.poids).toEqual([]);
  });
});

describe("libelleRecords", () => {
  it("assemble les records battus en une phrase", () => {
    expect(libelleRecords([])).toBe("");
    expect(libelleRecords(["poids"])).toBe("charge");
    expect(libelleRecords(["poids", "e1rm"])).toBe("charge et 1RM estimé");
    expect(libelleRecords(["poids", "e1rm", "reps"])).toBe("charge, 1RM estimé et répétitions");
  });
});
