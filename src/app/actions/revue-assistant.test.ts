// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  gemini: vi.fn(),
  evenements: vi.fn(),
  sante: vi.fn(),
  aujourdhui: "2026-11-02",
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/gemini/appel", () => ({ appelerGemini: etat.gemini, MESSAGE_QUOTA_GEMINI: "Quota atteint." }));
vi.mock("@/app/actions/evenements", () => ({ getEvenements: etat.evenements }));
vi.mock("@/app/actions/sante", () => ({ getSyntheseSemaine: etat.sante }));
vi.mock("@/lib/date/paris", () => ({ aujourdhuiParis: () => etat.aujourdhui }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }));

import {
  analyserSemaine,
  appliquerReplanification,
  proposerReplanification,
  synthetiserRevue,
} from "./revue-assistant";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function tache(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    titre: `Tâche ${id.slice(0, 2)}`,
    echeance: "2026-10-30",
    fait: false,
    termine_le: null,
    duree_minutes: null,
    priorite: "aucune",
    heure: null,
    ...extra,
  };
}

type Options = {
  enRetard?: unknown[];
  prevues?: unknown[];
  terminees?: unknown[];
  actives?: unknown[];
  habitudes?: unknown[];
  entrees?: unknown[];
  notes?: unknown[];
  erreurTaches?: boolean;
  erreurUpdate?: boolean;
  erreurNotes?: boolean;
  erreurHabitudes?: boolean;
};

// Les requêtes sur `taches` sont distinguées par leurs filtres (comme le code les écrit).
function brancher(options: Options = {}) {
  const repondre: Repondre = (a) => {
    if (a.table === "taches") {
      if (a.action === "update") return options.erreurUpdate ? { error: { message: "boom" } } : {};
      if (options.erreurTaches) return { error: { message: "boom" } };
      const filtres = JSON.stringify(a.filtres);
      if (filtres.includes('"fait",true')) return { data: options.terminees ?? [] };
      if (a.filtres.some((f) => f[0] === "in")) return { data: options.actives ?? [] };
      if (a.filtres.some((f) => f[0] === "lt")) return { data: options.enRetard ?? [] };
      return { data: options.prevues ?? [] };
    }
    if (a.table === "habitudes") {
      return options.erreurHabitudes ? { error: { message: "boom" } } : { data: options.habitudes ?? [] };
    }
    if (a.table === "habitude_entries") return { data: options.entrees ?? [] };
    if (a.table === "notes") {
      return options.erreurNotes ? { error: { message: "boom" } } : { data: options.notes ?? [] };
    }
    return { data: [] };
  };
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => {
  etat.gemini.mockReset();
  etat.evenements.mockReset();
  etat.evenements.mockResolvedValue([]);
  etat.sante.mockReset();
  etat.sante.mockResolvedValue({
    kcal: null,
    seances: { faites: 0, total: 0 },
    poids: null,
    taille: null,
    derniereMesure: null,
  });
  etat.aujourdhui = "2026-11-02";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("synthetiserRevue", () => {
  it("refuse un type inconnu", async () => {
    brancher();
    expect((await synthetiserRevue("autre" as never)).ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("répond sans Gemini quand la semaine à venir est vide", async () => {
    brancher();
    const r = await synthetiserRevue("avenir");
    expect(r.ok).toBe(true);
    expect(r.data?.resume).toContain("libre");
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("résume la semaine à venir avec les tâches, rendez-vous et retards", async () => {
    brancher({ prevues: [tache(ID_A, { echeance: "2026-11-03" }), tache(ID_B, { echeance: "2026-10-30" })] });
    etat.evenements.mockResolvedValue([
      { titre: "Dentiste", date: "2026-11-04", heure: "17:00:00", heure_fin: "17:30:00", toute_la_journee: false },
    ]);
    etat.gemini.mockResolvedValue({ ok: true, brut: { resume: "Semaine tranquille.", points: ["Mercredi : dentiste"] } });

    const r = await synthetiserRevue("avenir", true);

    expect(r).toEqual({ ok: true, data: { resume: "Semaine tranquille.", points: ["Mercredi : dentiste"] } });
    const prompt = etat.gemini.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Dentiste");
    expect(prompt).toContain("Tâches en retard (échéance dépassée, non faites) : 1.");
  });

  it("fait le bilan de la semaine écoulée", async () => {
    brancher({
      terminees: [tache(ID_A, { fait: true, termine_le: "2026-11-01T10:00:00Z", echeance: null, titre: "Payer le loyer" })],
    });
    etat.gemini.mockResolvedValue({ ok: true, brut: { resume: "Bonne semaine.", points: [] } });

    const r = await synthetiserRevue("bilan", true);

    expect(r.ok).toBe(true);
    expect(etat.gemini.mock.calls[0][0].prompt).toContain("Payer le loyer");
  });

  it("répond sans Gemini quand il n'y a rien à bilanter", async () => {
    brancher();
    const r = await synthetiserRevue("bilan");
    expect(r.ok).toBe(true);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("réutilise le résultat gardé, sauf en régénérant", async () => {
    brancher({ prevues: [tache(ID_A, { echeance: "2026-11-03", titre: "Cache unique" })] });
    etat.gemini.mockResolvedValue({ ok: true, brut: { resume: "R", points: [] } });
    await synthetiserRevue("avenir");
    await synthetiserRevue("avenir");
    expect(etat.gemini).toHaveBeenCalledTimes(1);
    await synthetiserRevue("avenir", true);
    expect(etat.gemini).toHaveBeenCalledTimes(2);
  });

  it("traduit un quota atteint, un échec et une réponse inutilisable", async () => {
    brancher({ prevues: [tache(ID_A, { echeance: "2026-11-03", titre: "Erreurs" })] });
    etat.gemini.mockResolvedValueOnce({ ok: false, code: "quota", detail: "429" });
    expect(await synthetiserRevue("avenir", true)).toEqual({ ok: false, error: "Quota atteint." });

    etat.gemini.mockResolvedValueOnce({ ok: false, code: "echec", detail: "Délai dépassé." });
    const r2 = await synthetiserRevue("avenir", true);
    expect(r2.ok).toBe(false);
    expect(r2.error).toContain("Délai dépassé.");

    etat.gemini.mockResolvedValueOnce({ ok: true, brut: { resume: "", points: [] } });
    expect((await synthetiserRevue("avenir", true)).error).toContain("inutilisable");
  });

  it("échoue proprement quand les données ne se lisent pas", async () => {
    brancher({ erreurTaches: true });
    const r = await synthetiserRevue("avenir");
    expect(r.ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });
});

describe("proposerReplanification", () => {
  it("n'appelle pas Gemini sans tâche en retard", async () => {
    brancher();
    const r = await proposerReplanification();
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Aucune tâche en retard");
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("propose des dates vérifiées sans rien écrire", async () => {
    const fake = brancher({ enRetard: [tache(ID_A), tache(ID_B, { echeance: "2026-10-29" })] });
    etat.gemini.mockResolvedValue({
      ok: true,
      brut: {
        propositions: [
          { id: ID_A, date: "2026-11-04", raison: "Mercredi est libre." },
          { id: ID_B, date: "2025-01-01", raison: "date passée" },
          { id: "inconnu", date: "2026-11-05", raison: "?" },
        ],
      },
    });

    const r = await proposerReplanification(true);

    expect(r.ok).toBe(true);
    expect(r.data?.propositions).toEqual([
      expect.objectContaining({ id: ID_A, nouvelle: "2026-11-04", echeanceActuelle: "2026-10-30" }),
    ]);
    expect(fake.appels.some((a) => a.action !== "select")).toBe(false);
  });

  it("explique quand Gemini ne propose rien d'utilisable", async () => {
    brancher({ enRetard: [tache(ID_A)] });
    etat.gemini.mockResolvedValue({ ok: true, brut: { propositions: [] } });
    const r = await proposerReplanification(true);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("aucune meilleure date");
  });

  it("renvoie le message de quota", async () => {
    brancher({ enRetard: [tache(ID_A)] });
    etat.gemini.mockResolvedValue({ ok: false, code: "quota", detail: "429" });
    expect(await proposerReplanification(true)).toEqual({ ok: false, error: "Quota atteint." });
  });
});

describe("analyserSemaine", () => {
  const HABITUDE = {
    id: "h1",
    nom: "Lecture",
    type: "boolean",
    valeur_cible: null,
    frequence_hebdo: null,
    created_at: "2026-01-01T08:00:00Z",
  };

  it("répond sans Gemini quand tout est vide", async () => {
    brancher();
    const r = await analyserSemaine();
    expect(r.ok).toBe(true);
    expect(r.data?.resume).toContain("Rien à analyser");
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("croise tâches, agenda, habitudes, santé et notes dans une seule consigne", async () => {
    brancher({
      terminees: [tache(ID_A, { fait: true, termine_le: "2026-11-01T10:00:00Z", echeance: null, titre: "Payer le loyer" })],
      prevues: [tache(ID_B, { echeance: "2026-10-30" })],
      habitudes: [HABITUDE],
      entrees: [
        { habitude_id: "h1", date: "2026-10-30", valeur: 1 },
        { habitude_id: "h1", date: "2026-11-01", valeur: 1 },
      ],
      notes: [{ titre: "Idée d'app", created_at: "2026-11-01T09:00:00Z" }],
    });
    etat.evenements.mockResolvedValue([
      { titre: "Dentiste", date: "2026-11-04", heure: "17:00:00", heure_fin: "17:30:00", toute_la_journee: false },
    ]);
    etat.sante.mockResolvedValue({
      kcal: { moyenne: 1900, cibleMoyenne: 2000, nbJours: 6, nbDansLimite: 5 },
      seances: { faites: 2, total: 3 },
      poids: { actuel: 82.4, delta: -0.6, ageJours: 0 },
      taille: null,
      derniereMesure: "2026-11-02",
    });
    etat.gemini.mockResolvedValue({
      ok: true,
      brut: { resume: "Bonne semaine.", constats: ["Retards maîtrisés"], pistes: ["Planifier le sport"] },
    });

    const r = await analyserSemaine(true);

    expect(r).toEqual({
      ok: true,
      data: { resume: "Bonne semaine.", constats: ["Retards maîtrisés"], pistes: ["Planifier le sport"] },
    });
    const prompt = etat.gemini.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Payer le loyer");
    expect(prompt).toContain("Lecture 2/7");
    expect(prompt).toContain("kcal moyens 1900");
    expect(prompt).toContain("Idée d'app");
  });

  it("laisse de côté un module illisible au lieu d'échouer", async () => {
    brancher({ erreurNotes: true, terminees: [tache(ID_A, { fait: true, termine_le: "2026-11-01T10:00:00Z", echeance: null })] });
    etat.sante.mockRejectedValue(new Error("santé indisponible"));
    etat.gemini.mockResolvedValue({ ok: true, brut: { resume: "OK", constats: [], pistes: [] } });

    const r = await analyserSemaine(true);

    expect(r.ok).toBe(true);
    const prompt = etat.gemini.mock.calls[0][0].prompt as string;
    expect(prompt).not.toContain("Santé :");
    expect(prompt).not.toContain("Notes :");
    expect(prompt).toContain("Tâches :");
  });

  it("échoue proprement quand aucun module ne se lit", async () => {
    brancher({ erreurTaches: true, erreurNotes: true, erreurHabitudes: true });
    etat.evenements.mockRejectedValue(new Error("boom"));
    etat.sante.mockRejectedValue(new Error("boom"));
    const r = await analyserSemaine(true);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("n'ont pas pu être lues");
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("réutilise le résultat gardé, sauf en régénérant, et traduit les erreurs de Gemini", async () => {
    brancher({ terminees: [tache(ID_A, { fait: true, termine_le: "2026-11-01T10:00:00Z", echeance: null, titre: "Cache analyse" })] });
    etat.gemini.mockResolvedValue({ ok: true, brut: { resume: "R", constats: [], pistes: [] } });
    await analyserSemaine();
    await analyserSemaine();
    expect(etat.gemini).toHaveBeenCalledTimes(1);

    etat.gemini.mockResolvedValueOnce({ ok: false, code: "quota", detail: "429" });
    expect(await analyserSemaine(true)).toEqual({ ok: false, error: "Quota atteint." });

    etat.gemini.mockResolvedValueOnce({ ok: true, brut: { resume: "", constats: [], pistes: [] } });
    expect((await analyserSemaine(true)).error).toContain("inutilisable");
  });
});

describe("appliquerReplanification", () => {
  it("met à jour l'échéance et remet les rappels à zéro, seulement pour les tâches encore à faire", async () => {
    const fake = brancher({ actives: [{ id: ID_A }] });
    const r = await appliquerReplanification([
      { id: ID_A, echeance: "2026-11-04" },
      { id: ID_B, echeance: "2026-11-05" },
    ]);
    expect(r).toEqual({ ok: true, data: { nb: 1 } });
    const updates = fake.appels.filter((a) => a.action === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({ echeance: "2026-11-04", rappel_envoye_le: null, rappel_reporte_jusqua: null });
    expect(updates[0].filtres).toContainEqual(["eq", "id", ID_A]);
  });

  it("refuse une sélection ou une date invalide", async () => {
    const fake = brancher();
    expect((await appliquerReplanification([])).ok).toBe(false);
    expect((await appliquerReplanification([{ id: "pas-un-uuid", echeance: "2026-11-04" }])).ok).toBe(false);
    expect((await appliquerReplanification([{ id: ID_A, echeance: "2026-10-01" }])).ok).toBe(false);
    expect((await appliquerReplanification([{ id: ID_A, echeance: "2027-01-01" }])).ok).toBe(false);
    expect(
      (await appliquerReplanification([{ id: ID_A, echeance: "2026-11-04" }, { id: ID_A, echeance: "2026-11-05" }])).ok
    ).toBe(false);
    expect(fake.appels).toHaveLength(0);
  });

  it("signale des tâches qui ne sont plus à faire", async () => {
    brancher({ actives: [] });
    const r = await appliquerReplanification([{ id: ID_A, echeance: "2026-11-04" }]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("plus à faire");
  });

  it("remonte une erreur d'écriture", async () => {
    brancher({ actives: [{ id: ID_A }], erreurUpdate: true });
    expect((await appliquerReplanification([{ id: ID_A, echeance: "2026-11-04" }])).ok).toBe(false);
  });
});
