import { describe, expect, it } from "vitest";
import {
  composerRappelSeance,
  jourDeSemaine,
  seanceDue,
} from "../../../supabase/functions/envoyer-rappels-seances/compose";

describe("jourDeSemaine", () => {
  it("0 = dimanche", () => {
    expect(jourDeSemaine("2026-10-11")).toBe(0);
    expect(jourDeSemaine("2026-10-14")).toBe(3);
  });
});

describe("seanceDue", () => {
  const base = { date: "2026-10-14", heure: "18:00:00", today: "2026-10-14", rappelEnvoye: false };

  it("à l'heure pile : oui", () => expect(seanceDue({ ...base, maintenantMinutes: 18 * 60 })).toBe(true));
  it("avant l'heure : non", () => expect(seanceDue({ ...base, maintenantMinutes: 18 * 60 - 1 })).toBe(false));
  it("rattrape un cron manqué dans la tolérance (30 min)", () => {
    expect(seanceDue({ ...base, maintenantMinutes: 18 * 60 + 30 })).toBe(true);
    expect(seanceDue({ ...base, maintenantMinutes: 18 * 60 + 31 })).toBe(false);
  });
  it("jamais deux fois", () => expect(seanceDue({ ...base, maintenantMinutes: 18 * 60, rappelEnvoye: true })).toBe(false));
  it("jamais pour un autre jour (séance décalée)", () =>
    expect(seanceDue({ ...base, date: "2026-10-15", maintenantMinutes: 18 * 60 })).toBe(false));
});

describe("composerRappelSeance", () => {
  it("nomme la séance et propose de commencer ou décaler", () => {
    expect(composerRappelSeance({ type: "Renfo", heure: "18:00:00" })).toEqual({
      title: "Séance : Renfo",
      body: "C'est l'heure (18:00). Tu commences, ou tu la décales ?",
    });
  });
});
