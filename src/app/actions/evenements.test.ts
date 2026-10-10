// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { createEvenement, deleteEvenement, getEvenements, updateEvenement, type EvenementInput } from "./evenements";

const ID = "11111111-1111-4111-8111-111111111111";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

const base: EvenementInput = { titre: "Dentiste", date: "2026-10-12", heure: "09:00", dureeMinutes: 60 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createEvenement : validation", () => {
  it.each([
    ["titre vide", { ...base, titre: "  " }, "Le titre est requis."],
    ["date invalide", { ...base, date: "12/10/2026" }, "Date invalide."],
    ["heure invalide", { ...base, heure: "9h" }, "Heure invalide (format HH:MM)."],
    ["durée qui déborde", { ...base, heure: "23:30", dureeMinutes: 120 }, "La durée doit tenir dans la journée."],
    ["rappel inconnu", { ...base, rappelMinutes: 7 }, "Rappel invalide."],
    [
      "rappel autre que la veille pour une journée entière",
      { ...base, toute_la_journee: true, rappelMinutes: 15 },
      "Une journée entière ne peut être rappelée que la veille.",
    ],
    [
      "fin de récurrence avant l'événement",
      { ...base, recurrenceFrequence: "hebdomadaire" as const, recurrenceFin: "2026-10-01" },
      "La fin de la récurrence doit être après la date de l'événement.",
    ],
  ])("refuse : %s", async (_nom, input, erreur) => {
    const fake = brancher();
    expect(await createEvenement(input)).toEqual({ ok: false, error: erreur });
    expect(fake.appels).toHaveLength(0);
  });
});

describe("createEvenement", () => {
  it("écrit l'événement normalisé et revalide Aujourd'hui et l'agenda", async () => {
    const fake = brancher(() => ({ data: { id: ID } }));

    const res = await createEvenement({ ...base, titre: "  Dentiste ", notes: "  apporter carte  ", rappelMinutes: 30 });

    expect(res).toEqual({ ok: true, data: { id: ID } });
    expect(ecritures(fake.appels, "evenements", "insert")[0].payload).toMatchObject({
      titre: "Dentiste",
      date: "2026-10-12",
      heure: "09:00",
      heure_fin: "10:00",
      notes: "apporter carte",
      toute_la_journee: false,
      rappel_minutes: 30,
      recurrence_frequence: null,
      recurrence_fin: null,
    });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/aujourdhui");
    expect(etat.revalidatePath).toHaveBeenCalledWith("/agenda");
  });

  it("ignore heure et durée pour une journée entière et accepte le rappel la veille", async () => {
    const fake = brancher(() => ({ data: { id: ID } }));
    const res = await createEvenement({ ...base, heure: "n'importe quoi", toute_la_journee: true, rappelMinutes: 1440 });
    expect(res).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "evenements", "insert")[0].payload).toMatchObject({
      toute_la_journee: true,
      rappel_minutes: 1440,
    });
  });

  it("conserve la fin de récurrence seulement si l'événement est récurrent", async () => {
    const fake = brancher(() => ({ data: { id: ID } }));
    await createEvenement({ ...base, recurrenceFrequence: "hebdomadaire", recurrenceFin: "2026-12-31" });
    await createEvenement({ ...base, recurrenceFin: "2026-12-31" });
    const [avec, sans] = ecritures(fake.appels, "evenements", "insert");
    expect(avec.payload).toMatchObject({ recurrence_frequence: "hebdomadaire", recurrence_fin: "2026-12-31" });
    expect(sans.payload).toMatchObject({ recurrence_frequence: null, recurrence_fin: null });
  });

  it("renvoie l'erreur Supabase sans revalider", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await createEvenement(base)).toEqual({ ok: false, error: "ko" });
    expect(etat.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateEvenement", () => {
  it("refuse un id invalide ou une saisie invalide", async () => {
    const fake = brancher();
    expect(await updateEvenement("x", base)).toEqual({ ok: false, error: "Événement introuvable." });
    expect(await updateEvenement(ID, { ...base, titre: "" })).toEqual({ ok: false, error: "Le titre est requis." });
    expect(fake.appels).toHaveLength(0);
  });

  it("met à jour la ligne ciblée avec updated_at", async () => {
    const fake = brancher();
    expect(await updateEvenement(ID, base)).toMatchObject({ ok: true });
    const [maj] = ecritures(fake.appels, "evenements", "update");
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);
    expect(maj.payload).toMatchObject({ titre: "Dentiste", updated_at: expect.any(String) });
  });

  it("renvoie l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await updateEvenement(ID, base)).toEqual({ ok: false, error: "ko" });
  });
});

describe("deleteEvenement", () => {
  it("valide l'id, supprime et renvoie les erreurs", async () => {
    const fake = brancher();
    expect(await deleteEvenement("x")).toEqual({ ok: false, error: "Événement introuvable." });
    expect(await deleteEvenement(ID)).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "evenements", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);

    brancher(() => ({ error: { message: "ko" } }));
    expect(await deleteEvenement(ID)).toEqual({ ok: false, error: "ko" });
  });
});

describe("getEvenements", () => {
  it("renvoie [] sans requête pour des dates invalides", async () => {
    const fake = brancher();
    expect(await getEvenements("hier", "2026-10-31")).toEqual([]);
    expect(fake.appels).toHaveLength(0);
  });

  it("trie par date puis heure", async () => {
    const ligne = (id: string, date: string, heure: string) => ({
      id,
      date,
      heure,
      heure_fin: heure,
      titre: id,
      recurrence_frequence: null,
      recurrence_fin: null,
    });
    brancher(() => ({ data: [ligne("c", "2026-10-14", "08:00"), ligne("b", "2026-10-12", "15:00"), ligne("a", "2026-10-12", "09:00")] }));

    const res = await getEvenements("2026-10-01", "2026-10-31");

    expect(res.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("renvoie [] quand la table n'existe pas encore, lève pour les autres erreurs", async () => {
    brancher(() => ({ error: { message: "absente", code: "42P01" } }));
    expect(await getEvenements("2026-10-01", "2026-10-31")).toEqual([]);
    brancher(() => ({ error: { message: "absente", code: "PGRST205" } }));
    expect(await getEvenements("2026-10-01", "2026-10-31")).toEqual([]);

    brancher(() => ({ error: { message: "ko", code: "500" } }));
    await expect(getEvenements("2026-10-01", "2026-10-31")).rejects.toThrow("ko");
  });
});
