import { describe, expect, it } from "vitest";
import { candidatesPlanDuJour, construirePlanDuJour, type TachePlanifiable } from "./plan";

const TODAY = "2026-10-09";
let n = 0;
function t(over: Partial<TachePlanifiable> = {}): TachePlanifiable {
  return {
    id: `t${++n}`,
    fait: false,
    echeance: TODAY,
    heure: null,
    toute_la_journee: false,
    priorite: "aucune",
    duree_minutes: 30,
    ...over,
  };
}

describe("candidatesPlanDuJour", () => {
  it("garde retards et tâches du jour sans heure, écarte le reste", () => {
    const retard = t({ echeance: "2026-10-05", heure: "09:00" });
    const sansHeure = t();
    const exclues = [
      t({ fait: true }),
      t({ toute_la_journee: true }),
      t({ heure: "10:00" }),
      t({ echeance: "2026-10-10" }),
      t({ echeance: null }),
    ];
    const resultat = candidatesPlanDuJour([...exclues, sansHeure, retard], TODAY);
    expect(resultat.map((x) => x.id)).toEqual([retard.id, sansHeure.id]);
  });

  it("classe par priorité puis par retard le plus ancien", () => {
    const basseAncienne = t({ priorite: "basse", echeance: "2026-10-01" });
    const haute = t({ priorite: "haute" });
    const aucuneRetard = t({ echeance: "2026-10-03" });
    const aucuneJour = t();
    expect(candidatesPlanDuJour([aucuneJour, basseAncienne, aucuneRetard, haute], TODAY).map((x) => x.id)).toEqual([
      haute.id,
      basseAncienne.id,
      aucuneRetard.id,
      aucuneJour.id,
    ]);
  });
});

describe("construirePlanDuJour", () => {
  it("range les tâches au plus tôt dans les trous, en consommant le trou", () => {
    const a = t({ priorite: "haute", duree_minutes: 60 });
    const b = t({ duree_minutes: 30 });
    const plan = construirePlanDuJour([b, a], [{ debut: "14:00", fin: "16:00" }], TODAY);
    expect(plan.propositions.map((p) => [p.tache.id, p.creneau.debut, p.creneau.fin])).toEqual([
      [a.id, "14:00", "15:00"],
      [b.id, "15:00", "15:30"],
    ]);
    expect(plan.nonPlacees).toEqual([]);
  });

  it("passe au trou suivant quand le premier est trop court", () => {
    const a = t({ duree_minutes: 90 });
    const plan = construirePlanDuJour([a], [{ debut: "12:00", fin: "12:30" }, { debut: "17:00", fin: "19:00" }], TODAY);
    expect(plan.propositions[0].creneau).toEqual({ debut: "17:00", fin: "18:30" });
  });

  it("signale les tâches non placées et la surcharge", () => {
    const a = t({ duree_minutes: 120 });
    const b = t({ duree_minutes: 60 });
    const plan = construirePlanDuJour([a, b], [{ debut: "18:00", fin: "19:00" }], TODAY);
    expect(plan.propositions.map((p) => p.tache.id)).toEqual([b.id]);
    expect(plan.nonPlacees.map((x) => x.id)).toEqual([a.id]);
    expect(plan.minutesDemandees).toBe(180);
    expect(plan.minutesLibres).toBe(60);
  });

  it("plafonne le nombre de propositions", () => {
    const taches = Array.from({ length: 8 }, () => t({ duree_minutes: 15 }));
    const plan = construirePlanDuJour(taches, [{ debut: "08:00", fin: "20:00" }], TODAY, 5);
    expect(plan.propositions).toHaveLength(5);
    expect(plan.nonPlacees).toHaveLength(3);
  });

  it("utilise 30 min quand la durée est inconnue", () => {
    const plan = construirePlanDuJour([t({ duree_minutes: null })], [{ debut: "10:00", fin: "11:00" }], TODAY);
    expect(plan.propositions[0].creneau).toEqual({ debut: "10:00", fin: "10:30" });
  });

  it("aucun trou libre : rien de proposé", () => {
    const plan = construirePlanDuJour([t()], [], TODAY);
    expect(plan.propositions).toEqual([]);
    expect(plan.nonPlacees).toHaveLength(1);
  });
});
