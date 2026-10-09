import { describe, expect, it } from "vitest";
import {
  briefingDu,
  composerBriefing,
  evenementALieuLe,
  type EvenementBriefing,
  type TacheBriefing,
} from "../../../supabase/functions/envoyer-briefing-matin/compose";

const TODAY = "2026-10-09";
const tache = (o: Partial<TacheBriefing> = {}): TacheBriefing => ({
  titre: "Tâche",
  echeance: TODAY,
  priorite: "aucune",
  heure: null,
  toute_la_journee: false,
  ...o,
});
const evt = (o: Partial<EvenementBriefing> = {}): EvenementBriefing => ({
  titre: "RDV",
  date: TODAY,
  heure: "09:30:00",
  toute_la_journee: false,
  recurrence_frequence: null,
  recurrence_fin: null,
  ...o,
});

describe("composerBriefing", () => {
  it("journée vide : pas de notification", () => {
    expect(composerBriefing({ today: TODAY, taches: [], evenements: [evt({ date: "2026-10-10" })] })).toBeNull();
  });

  it("résume événements, tâches, retards, premier rendez-vous et tâche prioritaire", () => {
    const b = composerBriefing({
      today: TODAY,
      evenements: [evt({ titre: "Dentiste", heure: "14:00:00" }), evt({ titre: "Appel", heure: "09:30:00" })],
      taches: [
        tache({ titre: "Courses" }),
        tache({ titre: "Facture", priorite: "haute", echeance: "2026-10-07" }),
      ],
    })!;
    expect(b.body).toBe("2 événements · 1 tâche · 1 en retard\nPremier : 09:30 Appel\nÀ faire : Facture");
  });

  it("événement récurrent compté le bon jour, journée entière sans heure", () => {
    const b = composerBriefing({
      today: TODAY,
      taches: [],
      evenements: [
        evt({ titre: "Hebdo", date: "2026-10-02", recurrence_frequence: "hebdomadaire" }),
        evt({ titre: "Anniv", date: "2025-10-09", toute_la_journee: true, recurrence_frequence: "annuel" }),
      ],
    })!;
    expect(b.body.split("\n")[0]).toBe("2 événements");
    expect(b.body).toContain("Premier : 09:30 Hebdo");
  });
});

describe("evenementALieuLe", () => {
  it("respecte la fin de récurrence", () => {
    const e = evt({ date: "2026-10-01", recurrence_frequence: "quotidien", recurrence_fin: "2026-10-05" });
    expect(evenementALieuLe(e, "2026-10-05")).toBe(true);
    expect(evenementALieuLe(e, "2026-10-06")).toBe(false);
  });
});

describe("briefingDu", () => {
  const base = { heure: "07:30:00", dernierEnvoi: null, today: TODAY };
  it("avant l'heure : non", () => expect(briefingDu({ ...base, maintenantMinutes: 7 * 60 + 29 })).toBe(false));
  it("à l'heure : oui", () => expect(briefingDu({ ...base, maintenantMinutes: 7 * 60 + 30 })).toBe(true));
  it("rattrape un retard dans la tolérance", () => expect(briefingDu({ ...base, maintenantMinutes: 9 * 60 })).toBe(true));
  it("trop tard : non", () => expect(briefingDu({ ...base, maintenantMinutes: 11 * 60 })).toBe(false));
  it("déjà envoyé aujourd'hui : non", () =>
    expect(briefingDu({ ...base, dernierEnvoi: TODAY, maintenantMinutes: 7 * 60 + 31 })).toBe(false));
});
