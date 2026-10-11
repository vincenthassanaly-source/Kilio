import { describe, expect, it } from "vitest";
import {
  dateDuJour,
  etatSeance,
  jourDeSemaine,
  planReports,
  prochainJourLibre,
  progressionSemaine,
  semaineDe,
  seancesAMaterialiser,
  trierSeances,
  type Creneau,
  type Seance,
} from "./compute";

// Semaine du lundi 2026-10-12 au dimanche 2026-10-18.
const creneau = (id: string, jour: number, extra: Partial<Creneau> = {}): Creneau => ({
  id,
  jour_semaine: jour,
  heure: "18:00:00",
  type: "Renfo",
  actif: true,
  ...extra,
});

const seance = (id: string, date: string, extra: Partial<Seance> = {}): Seance => ({
  id,
  creneau_id: id,
  date_prevue: date,
  date,
  heure: "18:00:00",
  type: "Renfo",
  statut: "prevue",
  reportee: false,
  ...extra,
});

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

  it("dateDuJour place le dimanche en fin de semaine", () => {
    expect(dateDuJour("2026-10-12", 1)).toBe("2026-10-12");
    expect(dateDuJour("2026-10-12", 0)).toBe("2026-10-18");
  });
});

describe("seancesAMaterialiser", () => {
  const creneaux = [creneau("a", 1), creneau("b", 3), creneau("c", 5)];

  it("crée une occurrence par créneau actif de la semaine", () => {
    const res = seancesAMaterialiser(creneaux, [], "2026-10-12");
    expect(res.map((s) => s.date)).toEqual(["2026-10-12", "2026-10-14", "2026-10-16"]);
    expect(res[0]).toMatchObject({ creneau_id: "a", date_prevue: "2026-10-12", heure: "18:00:00", type: "Renfo" });
  });

  it("ne recrée pas une occurrence existante, même déplacée", () => {
    const existantes = [{ creneau_id: "b", date_prevue: "2026-10-14" }];
    const res = seancesAMaterialiser(creneaux, existantes, "2026-10-12");
    expect(res.map((s) => s.creneau_id)).toEqual(["a", "c"]);
  });

  it("ignore les jours déjà passés et les créneaux inactifs", () => {
    const res = seancesAMaterialiser([...creneaux, creneau("d", 6, { actif: false })], [], "2026-10-15");
    expect(res.map((s) => s.creneau_id)).toEqual(["c"]);
  });
});

describe("prochainJourLibre", () => {
  const seances = [seance("a", "2026-10-13"), seance("b", "2026-10-14")];

  it("saute les jours occupés", () => {
    expect(prochainJourLibre(seances, "2026-10-12", "2026-10-18")).toBe("2026-10-15");
    expect(prochainJourLibre(seances, "2026-10-13", "2026-10-18")).toBe("2026-10-15");
  });

  it("exclut la date de départ elle-même", () => {
    expect(prochainJourLibre([], "2026-10-13", "2026-10-18")).toBe("2026-10-14");
  });

  it("renvoie null sans jour libre avant la fin de semaine", () => {
    expect(prochainJourLibre([seance("a", "2026-10-18")], "2026-10-17", "2026-10-18")).toBeNull();
  });
});

describe("planReports", () => {
  it("replace une séance manquée sur le prochain jour libre", () => {
    const seances = [seance("a", "2026-10-12"), seance("b", "2026-10-14"), seance("c", "2026-10-16")];
    // Mercredi 14 matin : le lundi est manqué ; mercredi est pris, jeudi est libre.
    expect(planReports(seances, "2026-10-14", "08:00", "2026-10-18")).toEqual([{ id: "a", date: "2026-10-15" }]);
  });

  it("peut replacer sur aujourd'hui tant que l'heure n'est pas passée", () => {
    const seances = [seance("a", "2026-10-12")];
    expect(planReports(seances, "2026-10-13", "09:00", "2026-10-18")).toEqual([{ id: "a", date: "2026-10-13" }]);
    expect(planReports(seances, "2026-10-13", "19:00", "2026-10-18")).toEqual([{ id: "a", date: "2026-10-14" }]);
  });

  it("répartit plusieurs séances manquées sur des jours distincts, dans l'ordre", () => {
    const seances = [seance("a", "2026-10-12"), seance("b", "2026-10-13")];
    expect(planReports(seances, "2026-10-15", "20:00", "2026-10-18")).toEqual([
      { id: "a", date: "2026-10-16" },
      { id: "b", date: "2026-10-17" },
    ]);
  });

  it("laisse manquée une séance sans jour libre et ne reporte qu'une fois", () => {
    expect(planReports([seance("a", "2026-10-17"), seance("b", "2026-10-18")], "2026-10-18", "20:00", "2026-10-18")).toEqual([]);
    expect(planReports([seance("a", "2026-10-12", { reportee: true })], "2026-10-14", "08:00", "2026-10-18")).toEqual([]);
  });

  it("ignore les séances faites", () => {
    expect(planReports([seance("a", "2026-10-12", { statut: "faite" })], "2026-10-14", "08:00", "2026-10-18")).toEqual([]);
  });
});

describe("etatSeance / tri / progression", () => {
  it("classe l'état d'une séance", () => {
    expect(etatSeance(seance("a", "2026-10-12", { statut: "faite" }), "2026-10-14")).toBe("faite");
    expect(etatSeance(seance("a", "2026-10-12"), "2026-10-14")).toBe("manquee");
    expect(etatSeance(seance("a", "2026-10-14"), "2026-10-14")).toBe("aujourdhui");
    expect(etatSeance(seance("a", "2026-10-15"), "2026-10-14")).toBe("a_venir");
  });

  it("trie par date puis heure", () => {
    const tri = trierSeances([
      seance("b", "2026-10-14", { heure: "19:00:00" }),
      seance("a", "2026-10-14", { heure: "07:00:00" }),
      seance("c", "2026-10-13"),
    ]);
    expect(tri.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("compte les séances faites", () => {
    expect(progressionSemaine([{ statut: "faite" }, { statut: "prevue" }, { statut: "faite" }])).toEqual({ faites: 2, total: 3 });
  });
});
