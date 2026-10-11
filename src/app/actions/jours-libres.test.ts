// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { getJoursLibres, getJoursLibresAutour, poserJourLibre, retirerJourLibre } from "./jours-libres";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

// Mercredi 2026-10-14, midi à Paris : la semaine va du 12 au 18.
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getJoursLibres", () => {
  it("renvoie les dates de la plage, ou lève l'erreur", async () => {
    const fake = brancher(() => ({ data: [{ date: "2026-10-13" }, { date: "2026-10-15" }] }));
    expect(await getJoursLibres("2026-10-12", "2026-10-18")).toEqual(["2026-10-13", "2026-10-15"]);
    expect(fake.appels[0].filtres).toContainEqual(["gte", "date", "2026-10-12"]);
    expect(fake.appels[0].filtres).toContainEqual(["lte", "date", "2026-10-18"]);

    brancher(() => ({ error: { message: "ko" } }));
    await expect(getJoursLibres("a", "b")).rejects.toThrow("ko");
  });

  it("lit la semaine en cours plus celle de demain pour Aujourd'hui", async () => {
    const fake = brancher();
    await getJoursLibresAutour("2026-10-18");
    expect(fake.appels[0].filtres).toContainEqual(["gte", "date", "2026-10-12"]);
    expect(fake.appels[0].filtres).toContainEqual(["lte", "date", "2026-10-25"]);
    await expect(getJoursLibresAutour("pas-une-date")).rejects.toThrow("Date invalide.");
  });
});

describe("poserJourLibre", () => {
  it("insère un jour libre aujourd'hui ou demain et revalide les écrans nutrition", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: [{ date: "2026-10-13" }] } : undefined));
    expect(await poserJourLibre("2026-10-15")).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "jours_libres", "insert")[0].payload).toEqual({ date: "2026-10-15" });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/nutrition/bilan");
  });

  it.each([
    ["après coup (hier)", "2026-10-13", [], "Un jour libre se pose le jour même ou la veille."],
    ["trop en avance", "2026-10-16", [], "Un jour libre se pose le jour même ou la veille."],
    ["déjà libre", "2026-10-14", ["2026-10-14"], "Ce jour est déjà un jour libre."],
    ["sans jeton", "2026-10-14", ["2026-10-12", "2026-10-13"], "Tu as déjà posé tes 2 jours libres cette semaine."],
    ["date invalide", "demain", [], "Date invalide."],
  ])("refuse : %s", async (_nom, date, existants, erreur) => {
    const fake = brancher((a) => (a.action === "select" ? { data: existants.map((d) => ({ date: d })) } : undefined));
    expect(await poserJourLibre(date)).toEqual({ ok: false, error: erreur });
    expect(ecritures(fake.appels, "jours_libres")).toHaveLength(0);
  });

  it("renvoie une erreur lisible si l'écriture échoue", async () => {
    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : { data: [] }));
    expect(await poserJourLibre("2026-10-14")).toEqual({ ok: false, error: "Le jour libre n'a pas pu être posé. Réessaie." });
  });
});

describe("retirerJourLibre", () => {
  it("retire un jour libre d'aujourd'hui ou à venir", async () => {
    const fake = brancher();
    expect(await retirerJourLibre("2026-10-14")).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "jours_libres", "delete")[0].filtres).toContainEqual(["eq", "date", "2026-10-14"]);
  });

  it("refuse de retirer un jour passé : la règle « jamais après coup » vaut aussi pour le retrait", async () => {
    const fake = brancher();
    expect(await retirerJourLibre("2026-10-13")).toEqual({
      ok: false,
      error: "Un jour libre passé ne peut plus être retiré.",
    });
    expect(ecritures(fake.appels, "jours_libres")).toHaveLength(0);
  });
});
