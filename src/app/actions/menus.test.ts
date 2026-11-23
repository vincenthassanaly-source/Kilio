// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn(), updateTag: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath, updateTag: etat.updateTag }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { annulerEnvoiMenuAuxCourses, updateMenuEntry } from "./menus";

const ID = "11111111-1111-4111-8111-111111111111";
const JOURNAL = "33333333-3333-4333-8333-333333333333";
const RECETTE = "22222222-2222-4222-8222-222222222222";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function form(champs: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

const saisie = { id: ID, type: "recette", recette_id: RECETTE, quantite: "1.5", date: "2026-11-10", moment: "diner" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateMenuEntry", () => {
  it("corrige un repas planifié sans toucher au Carnet quand il n'est pas mangé", async () => {
    const fake = brancher();
    expect(await updateMenuEntry({ error: null }, form(saisie))).toEqual({ error: null, ok: true });
    const [maj] = ecritures(fake.appels, "menus_repas", "update");
    expect(maj.payload).toEqual({ quantite: 1.5, moment: "diner", aliment_id: null, recette_id: RECETTE });
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);
    expect(ecritures(fake.appels, "journal_repas")).toHaveLength(0);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/nutrition/menus");
  });

  it("répercute la correction sur l'entrée liée du Carnet quand le repas est mangé", async () => {
    const fake = brancher((a) => (a.table === "menus_repas" ? { data: { journal_repas_id: JOURNAL } } : undefined));
    await updateMenuEntry({ error: null }, form(saisie));
    const [journal] = ecritures(fake.appels, "journal_repas", "update");
    expect(journal.payload).toEqual({ quantite: 1.5, moment: "diner", aliment_id: null, recette_id: RECETTE });
    expect(journal.filtres).toContainEqual(["eq", "id", JOURNAL]);
    expect(etat.revalidatePath).toHaveBeenCalledWith("/nutrition/journal");
  });

  it("refuse un id invalide et renvoie un message lisible en cas d'échec", async () => {
    const fake = brancher();
    expect(await updateMenuEntry({ error: null }, form({ ...saisie, id: "x" }))).toEqual({
      error: "Identifiant de repas invalide.",
    });
    expect(fake.appels).toHaveLength(0);

    brancher(() => ({ error: { message: "ko" } }));
    expect(await updateMenuEntry({ error: null }, form(saisie))).toEqual({
      error: "Le repas n'a pas pu être modifié. Réessaie.",
    });
  });
});

describe("annulerEnvoiMenuAuxCourses", () => {
  it("retire les articles créés et recoche les articles réactivés", async () => {
    const fake = brancher();
    expect((await annulerEnvoiMenuAuxCourses([ID], [JOURNAL])).ok).toBe(true);
    expect(ecritures(fake.appels, "courses_items", "delete")[0].filtres).toContainEqual(["in", "id", [ID]]);
    expect(ecritures(fake.appels, "courses_items", "update")[0].payload).toEqual({ coche: true });
  });

  it("renvoie un échec lisible au lieu de lever", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await annulerEnvoiMenuAuxCourses([ID], [])).toEqual({
      ok: false,
      error: "L'envoi aux Courses n'a pas pu être annulé. Réessaie.",
    });
  });
});
