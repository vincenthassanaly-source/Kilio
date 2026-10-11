// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { creerCreneau, marquerSeanceFaite, modifierCreneau, supprimerCreneau } from "./seances";

const ID = "11111111-1111-4111-8111-111111111111";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("creerCreneau", () => {
  it.each([
    ["type vide", { jourSemaine: 1, heure: "18:00", type: "  " }, "Choisis LEGS, PUSH ou PULL."],
    ["type hors liste", { jourSemaine: 1, heure: "18:00", type: "Renfo" }, "Choisis LEGS, PUSH ou PULL."],
    ["jour invalide", { jourSemaine: 7, heure: "18:00", type: "PUSH" }, "Jour invalide."],
    ["heure invalide", { jourSemaine: 1, heure: "25:00", type: "PUSH" }, "Heure invalide (format HH:MM)."],
  ])("refuse : %s", async (_nom, input, erreur) => {
    const fake = brancher();
    expect(await creerCreneau(input)).toEqual({ ok: false, error: erreur });
    expect(ecritures(fake.appels, "creneaux_seance")).toHaveLength(0);
  });

  it("insère le créneau nettoyé et revalide Aujourd'hui", async () => {
    const fake = brancher((a) => (a.action === "select" ? { count: 2 } : undefined));
    expect(await creerCreneau({ jourSemaine: 2, heure: "18:00", type: " PUSH " })).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "creneaux_seance", "insert")[0].payload).toEqual({
      jour_semaine: 2,
      heure: "18:00",
      type: "PUSH",
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/aujourdhui");
  });

  it("plafonne le nombre de créneaux", async () => {
    const fake = brancher((a) => (a.action === "select" ? { count: 14 } : undefined));
    expect(await creerCreneau({ jourSemaine: 2, heure: "18:00", type: "PUSH" })).toEqual({
      ok: false,
      error: "Tu ne peux pas planifier plus de 14 créneaux.",
    });
    expect(ecritures(fake.appels, "creneaux_seance")).toHaveLength(0);
  });
});

describe("modifierCreneau / supprimerCreneau", () => {
  it("rejettent un identifiant invalide", async () => {
    brancher();
    expect(await modifierCreneau("nope", { jourSemaine: 1, heure: "18:00", type: "PUSH" })).toEqual({
      ok: false,
      error: "Créneau introuvable.",
    });
    expect(await supprimerCreneau("nope")).toEqual({ ok: false, error: "Créneau introuvable." });
  });

  it("la modification retire les séances à venir non faites du créneau", async () => {
    const fake = brancher();
    expect(await modifierCreneau(ID, { jourSemaine: 3, heure: "07:30", type: "PULL" })).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "creneaux_seance", "update")[0].payload).toEqual({
      jour_semaine: 3,
      heure: "07:30",
      type: "PULL",
    });
    const [suppression] = ecritures(fake.appels, "seances", "delete");
    expect(suppression.filtres).toContainEqual(["eq", "creneau_id", ID]);
    expect(suppression.filtres).toContainEqual(["eq", "statut", "prevue"]);
  });

  it("la suppression retire d'abord les séances à venir, puis le créneau", async () => {
    const fake = brancher();
    expect(await supprimerCreneau(ID)).toEqual({ ok: true, data: undefined });
    expect(fake.appels.filter((a) => a.action === "delete").map((a) => a.table)).toEqual(["seances", "creneaux_seance"]);
  });
});

describe("marquerSeanceFaite", () => {
  it("fait de la date de la séance un jour d'entraînement", async () => {
    const fake = brancher((a) => (a.table === "seances" && a.action === "select" ? { data: { date: "2026-10-14" } } : undefined));
    expect(await marquerSeanceFaite(ID, true)).toEqual({ ok: true, data: undefined });
    expect(ecritures(fake.appels, "seances", "update")[0].payload).toEqual({ statut: "faite" });
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")[0].payload).toMatchObject({
      date: "2026-10-14",
      entraine: true,
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/nutrition/journal");
  });

  it("défaire la séance remet le jour en repos", async () => {
    const fake = brancher((a) => (a.table === "seances" && a.action === "select" ? { data: { date: "2026-10-14" } } : undefined));
    await marquerSeanceFaite(ID, false);
    expect(ecritures(fake.appels, "seances", "update")[0].payload).toEqual({ statut: "prevue" });
    expect(ecritures(fake.appels, "jours_entrainement", "upsert")[0].payload).toMatchObject({ entraine: false });
  });

  it("séance introuvable ou identifiant invalide : aucune écriture", async () => {
    const fake = brancher();
    expect(await marquerSeanceFaite("nope", true)).toEqual({ ok: false, error: "Séance introuvable." });
    expect(await marquerSeanceFaite(ID, true)).toEqual({ ok: false, error: "Séance introuvable." });
    expect(ecritures(fake.appels, "seances")).toHaveLength(0);
  });
});
