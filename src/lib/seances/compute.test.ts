import { describe, expect, it } from "vitest";
import {
  composerSemaine,
  estTypeSeance,
  jourDeSemaine,
  libellePastille,
  progressionSemaine,
  semaineDe,
  type EntrainementSemaine,
  type RoutineSemaine,
} from "./compute";

// Semaine du lundi 2026-10-12 au dimanche 2026-10-18.
const routine = (id: string, nom: string, type: RoutineSemaine["type"], nbExercices = 5): RoutineSemaine => ({
  id,
  nom,
  type,
  nbExercices,
});

const entrainement = (routine_id: string | null, type_seance: string | null = null, date = "2026-10-13"): EntrainementSemaine => ({
  routine_id,
  type_seance,
  date,
});

const ROUTINES: RoutineSemaine[] = [
  routine("l-b", "Legs B", "LEGS"),
  routine("l-a", "Legs A", "LEGS"),
  routine("pu-a", "Pull A", "PULL"),
  routine("ps-a", "Push A", "PUSH"),
  routine("ps-b", "Push B", "PUSH"),
];

describe("semaine", () => {
  it("jourDeSemaine : 0 = dimanche", () => {
    expect(jourDeSemaine("2026-10-11")).toBe(0);
    expect(jourDeSemaine("2026-10-12")).toBe(1);
  });

  it("semaineDe va du lundi au dimanche, dimanche compris", () => {
    expect(semaineDe("2026-10-14")).toEqual({ debut: "2026-10-12", fin: "2026-10-18" });
    expect(semaineDe("2026-10-12")).toEqual({ debut: "2026-10-12", fin: "2026-10-18" });
    expect(semaineDe("2026-10-18")).toEqual({ debut: "2026-10-12", fin: "2026-10-18" });
  });
});

describe("estTypeSeance", () => {
  it("n'accepte que LEGS, PUSH et PULL", () => {
    expect(estTypeSeance("PUSH")).toBe(true);
    expect(estTypeSeance("Renfo")).toBe(false);
  });
});

describe("libellePastille", () => {
  it("retire le mot du type, sans tenir compte de la casse", () => {
    expect(libellePastille("Legs A", "LEGS")).toBe("A");
    expect(libellePastille("push  b", "PUSH")).toBe("b");
  });

  it("garde le nom entier s'il ne reste rien ou si le type n'y figure pas", () => {
    expect(libellePastille("Legs", "LEGS")).toBe("Legs");
    expect(libellePastille("Jambes lourdes", "LEGS")).toBe("Jambes lourdes");
  });
});

describe("composerSemaine", () => {
  it("propose toujours Push, Pull et Legs dans cet ordre, routines triées A, B, C", () => {
    const { groupes } = composerSemaine(ROUTINES, []);
    expect(groupes.map((g) => g.type)).toEqual(["PUSH", "PULL", "LEGS"]);
    expect(groupes[0].routines.map((r) => r.pastille)).toEqual(["A", "B"]);
    expect(groupes[2].routines.map((r) => r.pastille)).toEqual(["A", "B"]);
  });

  it("rien n'est fait sans entraînement", () => {
    const { groupes } = composerSemaine(ROUTINES, []);
    expect(groupes.every((g) => !g.faite && g.routines.every((r) => !r.faite))).toBe(true);
    expect(progressionSemaine(groupes)).toEqual({ faites: 0, total: 3 });
  });

  it("un entraînement suivant une routine coche sa pastille et son type, pas les autres", () => {
    const { groupes } = composerSemaine(ROUTINES, [entrainement("l-a")]);
    const legs = groupes.find((g) => g.type === "LEGS");
    expect(legs?.faite).toBe(true);
    expect(legs?.routines.map((r) => r.faite)).toEqual([true, false]);
    expect(groupes.filter((g) => g.faite).map((g) => g.type)).toEqual(["LEGS"]);
  });

  it("le type enregistré compte même sans routine : séance libre, ou routine supprimée", () => {
    const { groupes } = composerSemaine(ROUTINES, [entrainement(null, "PULL")]);
    const pull = groupes.find((g) => g.type === "PULL");
    expect(pull?.faite).toBe(true);
    expect(pull?.routines.every((r) => !r.faite)).toBe(true);
  });

  it("un type invalide est ignoré", () => {
    const { groupes } = composerSemaine(ROUTINES, [entrainement(null, "Renfo")]);
    expect(progressionSemaine(groupes)).toEqual({ faites: 0, total: 3 });
  });

  it("compte les séances enregistrées à la date du jour", () => {
    const entrainements = [entrainement("ps-a", null, "2026-10-14"), entrainement("ps-b", null, "2026-10-15"), entrainement(null, "PUSH", "2026-10-15")];
    expect(composerSemaine(ROUTINES, entrainements, "2026-10-15").seancesAujourdhui).toBe(2);
    expect(composerSemaine(ROUTINES, entrainements, "2026-10-16").seancesAujourdhui).toBe(0);
    expect(composerSemaine(ROUTINES, entrainements).seancesAujourdhui).toBe(0);
  });

  it("plusieurs entraînements d'un même type comptent une seule fois", () => {
    const { groupes } = composerSemaine(ROUTINES, [entrainement("ps-a"), entrainement("ps-b", null, "2026-10-15"), entrainement(null, "PUSH")]);
    expect(progressionSemaine(groupes)).toEqual({ faites: 1, total: 3 });
    expect(groupes[0].routines.map((r) => r.faite)).toEqual([true, true]);
  });

  it("un type sans routine reste proposé (3 groupes), vide", () => {
    const { groupes } = composerSemaine([routine("ps-a", "Push A", "PUSH")], []);
    expect(groupes).toHaveLength(3);
    expect(groupes[1].routines).toEqual([]);
  });

  it("reprend le nombre d'exercices pour désactiver une routine vide", () => {
    const { groupes } = composerSemaine([routine("ps-a", "Push A", "PUSH", 0)], []);
    expect(groupes[0].routines[0].nbExercices).toBe(0);
  });
});

describe("progressionSemaine", () => {
  it("compte les types faits sur le total", () => {
    expect(progressionSemaine([{ faite: true }, { faite: false }, { faite: true }])).toEqual({ faites: 2, total: 3 });
  });
});
