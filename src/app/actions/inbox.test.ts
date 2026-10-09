// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({
  client: null as unknown,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: etat.revalidatePath,
  revalidateTag: etat.revalidateTag,
  updateTag: etat.updateTag,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import { addInboxItem, deleteInboxItem, getInboxItems, inboxVersNote, inboxVersTache } from "./inbox";

const ID = "11111111-1111-4111-8111-111111111111";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getInboxItems", () => {
  it("renvoie les captures, plus anciennes d'abord", async () => {
    const fake = brancher(() => ({ data: [{ id: ID, texte: "a" }] }));
    expect(await getInboxItems()).toEqual([{ id: ID, texte: "a" }]);
    expect(fake.appels[0].modificateurs).toContainEqual(["order", "created_at", { ascending: true }]);
  });

  it("renvoie une liste vide sans données et lève sur erreur", async () => {
    brancher();
    expect(await getInboxItems()).toEqual([]);
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getInboxItems()).rejects.toThrow("ko");
  });
});

describe("addInboxItem", () => {
  it("refuse un texte vide ou trop long sans écrire", async () => {
    const fake = brancher();
    expect(await addInboxItem("   ")).toEqual({ ok: false, error: "Écris quelque chose à capturer." });
    expect(await addInboxItem("x".repeat(4001))).toEqual({ ok: false, error: "Capture trop longue." });
    expect(fake.appels).toHaveLength(0);
  });

  it("enregistre le texte nettoyé et revalide l'inbox", async () => {
    const fake = brancher(() => ({ data: { id: ID } }));
    expect(await addInboxItem("  acheter du pain  ")).toEqual({ ok: true, data: { id: ID } });
    expect(ecritures(fake.appels, "inbox_items", "insert")[0].payload).toEqual({ texte: "acheter du pain" });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/inbox");
  });

  it("accepte exactement 4000 caractères et renvoie l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await addInboxItem("x".repeat(4000))).toEqual({ ok: false, error: "ko" });
  });
});

describe("deleteInboxItem", () => {
  it("refuse un id invalide, supprime sinon", async () => {
    const fake = brancher();
    expect(await deleteInboxItem("x")).toEqual({ ok: false, error: "Élément introuvable." });
    expect(fake.appels).toHaveLength(0);

    expect(await deleteInboxItem(ID)).toMatchObject({ ok: true });
    expect(ecritures(fake.appels, "inbox_items", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
  });

  it("renvoie l'erreur Supabase", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await deleteInboxItem(ID)).toEqual({ ok: false, error: "ko" });
  });
});

describe("inboxVersTache", () => {
  const capture = { id: ID, texte: "Appeler le médecin" };

  it("refuse un id invalide ou une capture absente", async () => {
    brancher();
    expect(await inboxVersTache("x")).toEqual({ ok: false, error: "Élément introuvable." });
    expect(await inboxVersTache(ID)).toEqual({ ok: false, error: "Élément introuvable." });
  });

  it("crée la tâche, retire la capture et revalide les écrans concernés", async () => {
    const fake = brancher((a) => {
      if (a.table === "inbox_items" && a.action === "select") return { data: capture };
      if (a.table === "listes_taches") return { data: { id: "L1" } };
      if (a.table === "taches" && a.action === "insert") return { data: { id: "T1" } };
      return undefined;
    });

    expect(await inboxVersTache(ID)).toEqual({ ok: true, data: { id: "T1" } });
    expect(ecritures(fake.appels, "taches", "insert")[0].payload).toMatchObject({ titre: "Appeler le médecin", liste_id: "L1" });
    expect(ecritures(fake.appels, "inbox_items", "delete")).toHaveLength(1);
    expect(etat.revalidateTag).toHaveBeenCalledWith("taches", { expire: 0 });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/inbox");
  });

  it("conserve la capture si la création de la tâche échoue", async () => {
    const fake = brancher((a) => {
      if (a.table === "inbox_items" && a.action === "select") return { data: capture };
      return undefined; // aucune liste de tâches
    });

    expect(await inboxVersTache(ID)).toEqual({ ok: false, error: "Crée d'abord une liste de tâches." });
    expect(ecritures(fake.appels, "inbox_items", "delete")).toHaveLength(0);
  });
});

describe("inboxVersNote", () => {
  it("refuse une capture absente", async () => {
    brancher();
    expect(await inboxVersNote(ID)).toEqual({ ok: false, error: "Élément introuvable." });
  });

  it("crée une note texte, retire la capture et expire le cache des notes", async () => {
    const fake = brancher((a) => {
      if (a.table === "inbox_items" && a.action === "select") return { data: { id: ID, texte: "Idée de recette" } };
      if (a.table === "notes") return { data: { id: "N1" } };
      return undefined;
    });

    expect(await inboxVersNote(ID)).toEqual({ ok: true, data: { id: "N1" } });
    expect(ecritures(fake.appels, "notes", "insert")[0].payload).toMatchObject({ titre: "Idée de recette", type: "texte" });
    expect(ecritures(fake.appels, "inbox_items", "delete")).toHaveLength(1);
    expect(etat.updateTag).toHaveBeenCalledWith("notes");
    expect(etat.revalidatePath).toHaveBeenCalledWith("/notes");
  });

  it("conserve la capture si l'insertion de la note échoue", async () => {
    const fake = brancher((a) => {
      if (a.table === "inbox_items" && a.action === "select") return { data: { id: ID, texte: "x" } };
      if (a.table === "notes") return { error: { message: "note ko" } };
      return undefined;
    });

    expect(await inboxVersNote(ID)).toEqual({ ok: false, error: "note ko" });
    expect(ecritures(fake.appels, "inbox_items", "delete")).toHaveLength(0);
    expect(etat.updateTag).not.toHaveBeenCalled();
  });
});
