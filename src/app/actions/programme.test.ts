import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTache } from "@/test/fixtures";

vi.mock("./taches", () => ({ getTachesAvecRelations: vi.fn() }));
vi.mock("./notes", () => ({ getNotesAvecRelations: vi.fn() }));
vi.mock("./habitudes", () => ({ getHabitudesDuJour: vi.fn() }));
vi.mock("./planning-travail", () => ({
  getPlanningTravail: vi.fn(),
  getPlanningTravailExceptions: vi.fn(),
}));
vi.mock("@/lib/programme/generation", () => ({ genererProgrammeParGemini: vi.fn() }));

import { genererProgrammeParGemini } from "@/lib/programme/generation";
import { getHabitudesDuJour } from "./habitudes";
import { getNotesAvecRelations } from "./notes";
import { getPlanningTravail, getPlanningTravailExceptions } from "./planning-travail";
import { getTachesAvecRelations } from "./taches";
import { genererProgrammeDuJour } from "./programme";

const gemini = vi.mocked(genererProgrammeParGemini);

// Mercredi 30 septembre 2026, 17:10 à Paris (UTC+2 en été) = 15:10 UTC.
const MAINTENANT = new Date("2026-09-30T15:10:00Z");
const AUJOURDHUI = "2026-09-30";

const travailMercredi = {
  id: 1,
  jour_semaine: 3, // mercredi
  heure_debut: "09:00:00",
  heure_fin: "17:00:00",
  frequence: "toutes_les_semaines",
  semaine_reference: null,
  updated_at: "2026-09-01T00:00:00Z",
};

function preparer(opts: { taches?: ReturnType<typeof makeTache>[]; creneaux?: unknown[]; exceptions?: unknown[] } = {}) {
  vi.mocked(getTachesAvecRelations).mockResolvedValue(opts.taches ?? [makeTache({ titre: "Appeler la banque", echeance: AUJOURDHUI })]);
  vi.mocked(getNotesAvecRelations).mockResolvedValue([]);
  vi.mocked(getHabitudesDuJour).mockResolvedValue([]);
  vi.mocked(getPlanningTravail).mockResolvedValue((opts.creneaux ?? [travailMercredi]) as never);
  vi.mocked(getPlanningTravailExceptions).mockResolvedValue((opts.exceptions ?? []) as never);
  gemini.mockResolvedValue({ intro: "Ok", propositions: [] });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MAINTENANT);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("genererProgrammeDuJour", () => {
  it("donne à Gemini l'heure, le travail du jour et les plages libres restantes", async () => {
    preparer();
    await genererProgrammeDuJour();

    expect(gemini).toHaveBeenCalledTimes(1);
    const { contexte } = gemini.mock.calls[0][0];
    expect(contexte.maintenant).toBe("17:10");
    expect(contexte.creneauxTravail).toEqual([{ debut: "09:00", fin: "17:00" }]);
    // Travail fini : de 17:10 (arrondi 17:10) à 22:00.
    expect(contexte.plagesLibres).toEqual([{ debut: "17:10", fin: "22:00" }]);
    expect(contexte.plafond).toBe(5); // 4 h 50 libres
  });

  it("retire les rendez-vous d'aujourd'hui des plages libres", async () => {
    preparer({
      taches: [
        makeTache({ titre: "Dentiste", echeance: AUJOURDHUI, heure: "18:00:00", heure_fin: "19:00:00" }),
        makeTache({ titre: "Coiffeur", echeance: AUJOURDHUI, heure: "20:00:00" }), // sans fin : 1 h
      ],
    });
    await genererProgrammeDuJour();

    const { contexte } = gemini.mock.calls[0][0];
    expect(contexte.plagesLibres).toEqual([
      { debut: "17:10", fin: "18:00" },
      { debut: "19:00", fin: "20:00" },
      { debut: "21:00", fin: "22:00" },
    ]);
    expect(contexte.plafond).toBe(3); // 50 + 60 + 60 = 170 min
  });

  it("ignore pour l'occupation une tâche faite, en retard ou sur toute la journée", async () => {
    preparer({
      taches: [
        makeTache({ titre: "Faite", echeance: AUJOURDHUI, heure: "18:00:00", fait: true }),
        makeTache({ titre: "Hier", echeance: "2026-09-29", heure: "18:00:00" }),
        makeTache({ titre: "Journée", echeance: AUJOURDHUI, heure: "18:00:00", toute_la_journee: true }),
      ],
    });
    await genererProgrammeDuJour();

    expect(gemini.mock.calls[0][0].contexte.plagesLibres).toEqual([{ debut: "17:10", fin: "22:00" }]);
  });

  it("n'envoie pas l'heure d'une tâche en retard (elle date d'un autre jour)", async () => {
    preparer({
      taches: [
        makeTache({ titre: "Hier", echeance: "2026-09-29", heure: "18:00:00", heure_fin: "19:00:00" }),
        makeTache({ titre: "Aujourd'hui", echeance: AUJOURDHUI, heure: "18:00:00", heure_fin: "19:00:00" }),
      ],
    });
    await genererProgrammeDuJour();

    const { taches } = gemini.mock.calls[0][0];
    expect(taches.find((t) => t.titre === "Hier")).toMatchObject({ heure: null, heureFin: null, enRetard: true });
    expect(taches.find((t) => t.titre === "Aujourd'hui")).toMatchObject({
      heure: "18:00",
      heureFin: "19:00",
      enRetard: false,
    });
  });

  it("jour de repos : aucun créneau de travail, toute la fin de journée libre", async () => {
    preparer({ creneaux: [] });
    await genererProgrammeDuJour();

    const { contexte } = gemini.mock.calls[0][0];
    expect(contexte.creneauxTravail).toEqual([]);
    expect(contexte.plagesLibres).toEqual([{ debut: "17:10", fin: "22:00" }]);
  });

  it("prend en compte une exception ponctuelle d'horaires", async () => {
    preparer({
      creneaux: [],
      exceptions: [{ id: 9, date: AUJOURDHUI, heure_debut: "19:00:00", heure_fin: "21:00:00", updated_at: "" }],
    });
    await genererProgrammeDuJour();

    const { contexte } = gemini.mock.calls[0][0];
    expect(contexte.creneauxTravail).toEqual([{ debut: "19:00", fin: "21:00" }]);
    expect(contexte.plagesLibres).toEqual([
      { debut: "17:10", fin: "19:00" },
      { debut: "21:00", fin: "22:00" },
    ]);
  });

  it("génère quand même si les horaires de travail sont illisibles", async () => {
    preparer();
    vi.mocked(getPlanningTravail).mockRejectedValue(new Error("boom"));
    vi.mocked(getPlanningTravailExceptions).mockRejectedValue(new Error("boom"));

    const r = await genererProgrammeDuJour();

    expect(r.ok).toBe(true);
    expect(gemini).toHaveBeenCalledTimes(1);
    expect(gemini.mock.calls[0][0].contexte.creneauxTravail).toEqual([]);
  });

  it("plus de plage libre le soir : message, sans appeler Gemini", async () => {
    vi.setSystemTime(new Date("2026-09-30T20:30:00Z")); // 22:30 à Paris
    preparer();

    const r = await genererProgrammeDuJour();

    expect(gemini).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      ok: true,
      data: { propositions: [], intro: expect.stringContaining("plus de plage libre") },
    });
  });

  it("rien à analyser : message calme, sans appeler Gemini", async () => {
    preparer({ taches: [] });

    const r = await genererProgrammeDuJour();

    expect(gemini).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, data: { intro: expect.stringContaining("Rien de particulier") } });
  });

  it("échec de Gemini : renvoie l'erreur habituelle", async () => {
    preparer();
    gemini.mockResolvedValue(null);

    const r = await genererProgrammeDuJour();

    expect(r).toEqual({ ok: false, error: "La génération du programme a échoué. Réessaie." });
  });
});
