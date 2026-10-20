import { describe, expect, it } from "vitest";
import { composerRappelVidage, rappelVidageDu } from "../../../supabase/functions/envoyer-rappel-vidage/compose";

const base = {
  today: "2026-10-19",
  maintenantMinutes: 21 * 60,
  heure: "21:00:00",
  feuilleEcrite: false,
  dernierEnvoi: null,
};

describe("rappelVidageDu", () => {
  it("rappelle à l'heure réglée quand la feuille du jour est vide", () => {
    expect(rappelVidageDu(base)).toBe(true);
  });

  it("n'envoie rien avant l'heure", () => {
    expect(rappelVidageDu({ ...base, maintenantMinutes: 20 * 60 + 59 })).toBe(false);
  });

  it("rattrape une minute manquée du cron, dans la tolérance", () => {
    expect(rappelVidageDu({ ...base, maintenantMinutes: 21 * 60 + 40 })).toBe(true);
    expect(rappelVidageDu({ ...base, maintenantMinutes: 21 * 60 + 181 })).toBe(false);
  });

  it("ne rappelle pas quand la feuille du jour est déjà écrite", () => {
    expect(rappelVidageDu({ ...base, feuilleEcrite: true })).toBe(false);
  });

  it("n'envoie qu'une fois par jour", () => {
    expect(rappelVidageDu({ ...base, dernierEnvoi: "2026-10-19" })).toBe(false);
    expect(rappelVidageDu({ ...base, dernierEnvoi: "2026-10-18" })).toBe(true);
  });
});

describe("composerRappelVidage", () => {
  it("renvoie un titre et un corps non vides, sans jugement", () => {
    const { title, body } = composerRappelVidage();
    expect(title.length).toBeGreaterThan(0);
    expect(body.length).toBeGreaterThan(0);
  });
});
