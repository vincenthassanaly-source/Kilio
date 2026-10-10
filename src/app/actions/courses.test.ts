// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn(), updateTag: vi.fn() }));

vi.mock("next/cache", () => ({
  revalidatePath: etat.revalidatePath,
  updateTag: etat.updateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  ajouterArticlesCourses,
  createCourseItem,
  deleteCourseItem,
  deleteCourseItems,
  getCoursesItems,
  restoreCourseItems,
  toggleCourseItem,
  updateCourseItem,
} from "./courses";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function attendreRevalidation() {
  expect(etat.revalidatePath).toHaveBeenCalledWith("/courses");
  expect(etat.updateTag).toHaveBeenCalledWith("courses");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getCoursesItems", () => {
  it("trie non cochés d'abord, puis du plus récent au plus ancien", async () => {
    const fake = brancher(() => ({ data: [{ id: ID1 }] }));
    expect(await getCoursesItems()).toEqual([{ id: ID1 }]);
    expect(fake.appels[0].modificateurs).toEqual([
      ["order", "coche", { ascending: true }],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("renvoie [] sans données et lève sur erreur", async () => {
    brancher();
    expect(await getCoursesItems()).toEqual([]);
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getCoursesItems()).rejects.toThrow("ko");
  });
});

describe("écritures unitaires", () => {
  it("createCourseItem nettoie le libellé, refuse le vide et expire le cache", async () => {
    const fake = brancher();
    await expect(createCourseItem("   ")).rejects.toThrow("Le libellé est requis.");
    expect(fake.appels).toHaveLength(0);

    await createCourseItem("  Lait ");
    expect(ecritures(fake.appels, "courses_items", "insert")[0].payload).toEqual({ libelle: "Lait" });
    attendreRevalidation();
  });

  it("toggleCourseItem coche l'article ciblé", async () => {
    const fake = brancher();
    await toggleCourseItem(ID1, true);
    const [maj] = ecritures(fake.appels, "courses_items", "update");
    expect(maj.payload).toEqual({ coche: true });
    expect(maj.filtres).toContainEqual(["eq", "id", ID1]);
    attendreRevalidation();
  });

  it("deleteCourseItem supprime l'article ciblé", async () => {
    const fake = brancher();
    await deleteCourseItem(ID1);
    expect(ecritures(fake.appels, "courses_items", "delete")[0].filtres).toContainEqual(["eq", "id", ID1]);
    attendreRevalidation();
  });

  it("updateCourseItem renomme (libellé nettoyé) et refuse le vide", async () => {
    const fake = brancher();
    await expect(updateCourseItem(ID1, " ")).rejects.toThrow("Le libellé est requis.");
    await updateCourseItem(ID1, "  Pain  ");
    expect(ecritures(fake.appels, "courses_items", "update")[0].payload).toEqual({ libelle: "Pain" });
  });

  it.each([
    ["createCourseItem", () => createCourseItem("x")],
    ["toggleCourseItem", () => toggleCourseItem(ID1, true)],
    ["deleteCourseItem", () => deleteCourseItem(ID1)],
    ["updateCourseItem", () => updateCourseItem(ID1, "x")],
    ["deleteCourseItems", () => deleteCourseItems([ID1])],
  ])("%s lève l'erreur Supabase sans expirer le cache", async (_nom, appel) => {
    brancher(() => ({ error: { message: "ko" } }));
    await expect(appel()).rejects.toThrow("ko");
    expect(etat.updateTag).not.toHaveBeenCalled();
  });
});

describe("deleteCourseItems", () => {
  it("ne fait rien pour une liste vide", async () => {
    const fake = brancher();
    await deleteCourseItems([]);
    expect(fake.appels).toHaveLength(0);
  });

  it("supprime par ids exacts, jamais par état coché", async () => {
    const fake = brancher();
    await deleteCourseItems([ID1, ID2]);
    const [sup] = ecritures(fake.appels, "courses_items", "delete");
    expect(sup.filtres).toEqual([["in", "id", [ID1, ID2]]]);
    attendreRevalidation();
  });
});

describe("ajouterArticlesCourses", () => {
  it("valide le lot : vide, trop gros, libellé vide ou trop long", async () => {
    const fake = brancher();
    await expect(ajouterArticlesCourses([])).rejects.toThrow("entre 1 et 30");
    await expect(ajouterArticlesCourses(Array.from({ length: 31 }, (_, i) => `a${i}`))).rejects.toThrow("entre 1 et 30");
    await expect(ajouterArticlesCourses(["ok", "  "])).rejects.toThrow("Le libellé est requis.");
    await expect(ajouterArticlesCourses(["x".repeat(101)])).rejects.toThrow("dépasse 100 caractères");
    expect(fake.appels).toHaveLength(0);
  });

  it("crée les nouveaux articles en un seul INSERT avec des created_at strictement croissants", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00.000Z"));
    const fake = brancher(() => ({ data: [] }));

    const res = await ajouterArticlesCourses(["Lait", "Pain"]);

    expect(res).toEqual({ crees: 2, reactives: 0, dejaPresents: [] });
    const insertions = ecritures(fake.appels, "courses_items", "insert");
    expect(insertions).toHaveLength(1);
    expect(insertions[0].payload).toEqual([
      { libelle: "Lait", created_at: "2026-10-09T10:00:00.000Z" },
      { libelle: "Pain", created_at: "2026-10-09T10:00:00.001Z" },
    ]);
    attendreRevalidation();
  });

  it("réactive un article archivé, signale un article actif déjà présent, sans doublon", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00.000Z"));
    const fake = brancher((a) =>
      a.action === "select"
        ? {
            data: [
              { id: ID1, libelle: "Lait", coche: false },
              { id: ID2, libelle: "Pain", coche: true },
            ],
          }
        : undefined
    );

    const res = await ajouterArticlesCourses(["Lait", "Pain", "Beurre"]);

    expect(res).toEqual({ crees: 1, reactives: 1, dejaPresents: ["Lait"] });
    expect(ecritures(fake.appels, "courses_items", "insert")[0].payload).toEqual([
      { libelle: "Beurre", created_at: "2026-10-09T10:00:00.000Z" },
    ]);
    const [reactivation] = ecritures(fake.appels, "courses_items", "update");
    expect(reactivation.payload).toEqual({ coche: false, created_at: "2026-10-09T10:00:00.001Z" });
    expect(reactivation.filtres).toContainEqual(["eq", "id", ID2]);
  });

  it("n'écrit rien quand tout est déjà présent mais expire quand même le cache", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: [{ id: ID1, libelle: "Lait", coche: false }] } : undefined));
    expect(await ajouterArticlesCourses(["lait"])).toEqual({ crees: 0, reactives: 0, dejaPresents: ["lait"] });
    expect(ecritures(fake.appels, "courses_items")).toHaveLength(0);
  });

  it("lève l'erreur de lecture, d'insertion et de réactivation", async () => {
    brancher(() => ({ error: { message: "lecture ko" } }));
    await expect(ajouterArticlesCourses(["a"])).rejects.toThrow("lecture ko");

    brancher((a) => (a.action === "insert" ? { error: { message: "insert ko" } } : { data: [] }));
    await expect(ajouterArticlesCourses(["a"])).rejects.toThrow("insert ko");

    brancher((a) =>
      a.action === "update"
        ? { error: { message: "maj ko" } }
        : { data: [{ id: ID1, libelle: "a", coche: true }] }
    );
    await expect(ajouterArticlesCourses(["a"])).rejects.toThrow("maj ko");
  });
});

describe("restoreCourseItems", () => {
  const item = { id: ID1, libelle: " Lait ", coche: true, created_at: "2026-10-01T08:00:00Z", termine_le: "2026-10-02T08:00:00Z" };

  it("ne fait rien pour une liste vide", async () => {
    const fake = brancher();
    await restoreCourseItems([]);
    expect(fake.appels).toHaveLength(0);
  });

  it("réinsère à l'identique (id, coche, dates) en ignorant les doublons", async () => {
    const fake = brancher();
    await restoreCourseItems([item]);
    const [up] = ecritures(fake.appels, "courses_items", "upsert");
    expect(up.payload).toEqual([
      { id: ID1, libelle: "Lait", coche: true, created_at: "2026-10-01T08:00:00Z", termine_le: "2026-10-02T08:00:00Z" },
    ]);
    attendreRevalidation();
  });

  it("refuse un libellé vide ou un id invalide avant d'écrire", async () => {
    const fake = brancher();
    await expect(restoreCourseItems([{ ...item, libelle: " " }])).rejects.toThrow("Le libellé est requis.");
    await expect(restoreCourseItems([{ ...item, id: "temp-1" }])).rejects.toThrow("Identifiant d'article invalide.");
    expect(fake.appels).toHaveLength(0);
  });

  it("lève l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    await expect(restoreCourseItems([item])).rejects.toThrow("ko");
  });
});
