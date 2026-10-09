import { describe, expect, it } from "vitest";
import {
  composerRappelRevue,
  jourDeSemaine,
  revueDue,
} from "../../../supabase/functions/envoyer-revue-hebdo/compose";

describe("jourDeSemaine", () => {
  it("0 = dimanche", () => {
    expect(jourDeSemaine("2026-10-11")).toBe(0);
    expect(jourDeSemaine("2026-10-12")).toBe(1);
  });
});

describe("revueDue", () => {
  const base = { today: "2026-10-11", jour: 0, heure: "18:00:00", dernierEnvoi: null };
  it("dimanche à 18h : oui", () => expect(revueDue({ ...base, maintenantMinutes: 18 * 60 })).toBe(true));
  it("avant l'heure : non", () => expect(revueDue({ ...base, maintenantMinutes: 17 * 60 + 59 })).toBe(false));
  it("rattrape un retard dans la tolérance (3 h)", () =>
    expect(revueDue({ ...base, maintenantMinutes: 20 * 60 })).toBe(true));
  it("trop tard : non", () => expect(revueDue({ ...base, maintenantMinutes: 22 * 60 })).toBe(false));
  it("autre jour : non", () => expect(revueDue({ ...base, today: "2026-10-12", maintenantMinutes: 18 * 60 })).toBe(false));
  it("déjà envoyé : non", () =>
    expect(revueDue({ ...base, dernierEnvoi: "2026-10-11", maintenantMinutes: 18 * 60 + 1 })).toBe(false));
});

describe("composerRappelRevue", () => {
  it("résume la semaine", () => {
    expect(composerRappelRevue({ terminees: 12, enRetard: 3, prevues: 8 }).body).toBe(
      "12 tâches terminées cette semaine\n3 en retard à replanifier\n8 tâches prévues les 7 prochains jours"
    );
  });
  it("accorde le singulier et signale l'absence de retard", () => {
    expect(composerRappelRevue({ terminees: 1, enRetard: 0, prevues: 1 }).body).toBe(
      "1 tâche terminée cette semaine\nRien en retard\n1 tâche prévue les 7 prochains jours"
    );
  });
});
