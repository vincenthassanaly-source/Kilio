import { describe, expect, it } from "vitest";
import { bilanSemaine, dateParisDe, nbSansDate, semaineProchaine } from "./compute";

const TODAY = "2026-10-11"; // dimanche
const t = (o: Partial<Parameters<typeof bilanSemaine>[0][number]> = {}) => ({
  id: Math.random().toString(36),
  fait: false,
  termine_le: null as string | null,
  echeance: null as string | null,
  duree_minutes: null as number | null,
  ...o,
});

describe("dateParisDe", () => {
  it("convertit un instant UTC tardif vers la date de Paris", () => {
    expect(dateParisDe("2026-10-10T22:30:00Z")).toBe("2026-10-11"); // 00:30 à Paris (UTC+2)
    expect(dateParisDe("2026-10-11T10:00:00Z")).toBe("2026-10-11");
  });
});

describe("bilanSemaine", () => {
  it("compte les tâches terminées des 7 derniers jours et les retards", () => {
    const recente = t({ fait: true, termine_le: "2026-10-09T08:00:00Z" });
    const limite = t({ fait: true, termine_le: "2026-10-05T10:00:00Z" }); // J-6, comprise
    const ancienne = t({ fait: true, termine_le: "2026-10-04T10:00:00Z" }); // J-7, exclue
    const retard = t({ echeance: "2026-10-08" });
    const aVenir = t({ echeance: "2026-10-12" });
    const bilan = bilanSemaine([ancienne, limite, recente, retard, aVenir], TODAY);
    expect(bilan.terminees).toEqual([recente, limite]);
    expect(bilan.nbEnRetard).toBe(1);
  });
});

describe("semaineProchaine", () => {
  it("couvre les 7 jours suivants et additionne la charge", () => {
    const lundi = "2026-10-12";
    const a = t({ echeance: lundi, duree_minutes: 120 });
    const b = t({ echeance: lundi }); // 30 min par défaut
    const faite = t({ echeance: lundi, fait: true, duree_minutes: 600 });
    const evt = { date: lundi, heure: "09:00:00", heure_fin: "10:30:00", toute_la_journee: false };
    const journee = { date: lundi, heure: "00:00:00", heure_fin: "23:59:00", toute_la_journee: true };
    const jours = semaineProchaine([a, b, faite], [evt, journee], TODAY);
    expect(jours).toHaveLength(7);
    expect(jours[0].date).toBe(lundi);
    expect(jours[6].date).toBe("2026-10-18");
    expect(jours[0].minutesTaches).toBe(150);
    expect(jours[0].minutesEvenements).toBe(90);
    expect(jours[0].charge).toBe(false);
  });

  it("signale un jour chargé (≥ 6 h)", () => {
    const [lundi] = semaineProchaine([t({ echeance: "2026-10-12", duree_minutes: 360 })], [], TODAY);
    expect(lundi.charge).toBe(true);
  });
});

describe("nbSansDate", () => {
  it("ne compte que les tâches actives sans échéance", () => {
    expect(nbSansDate([t(), t({ fait: true }), t({ echeance: "2026-10-12" })])).toBe(1);
  });
});
