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

import {
  addNoteItem,
  createNote,
  deleteNote,
  deleteNoteItem,
  getNotesAvecRelations,
  noteItemVersTache,
  noteVersTache,
  reorderNoteItems,
  toggleEpingle,
  toggleNoteItem,
  updateNote,
  updateNoteItemLibelle,
} from "./notes";

const ID = "11111111-1111-4111-8111-111111111111";
const TAG1 = "22222222-2222-4222-8222-222222222222";

function brancher(repondre?: Repondre) {
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

function form(champs: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

const texte = { titre: "Idées", contenu: "Voyage en Italie", type: "texte" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createNote : validation", () => {
  it.each([
    ["titre vide", { ...texte, titre: " " }, "Le titre est requis."],
    ["type inconnu", { ...texte, type: "dessin" }, "Type de note invalide."],
    ["couleur hors palette", { ...texte, couleur: "fuchsia" }, "Couleur invalide."],
    ["texte sans contenu", { ...texte, contenu: "  " }, "Le contenu est requis."],
  ])("refuse : %s", async (_nom, champs, erreur) => {
    const fake = brancher();
    expect(await createNote({ error: null }, form(champs))).toEqual({ error: erreur });
    expect(fake.appels).toHaveLength(0);
  });
});

describe("createNote", () => {
  it("crée une note texte, synchronise les tags et expire le cache", async () => {
    const fake = brancher((a) => (a.table === "notes" && a.action === "insert" ? { data: { id: ID } } : undefined));

    const res = await createNote({ error: null }, form({ ...texte, couleur: "sauge", tag_ids: [TAG1] }));

    expect(res).toEqual({ error: null });
    expect(ecritures(fake.appels, "notes", "insert")[0].payload).toEqual({
      titre: "Idées",
      contenu: "Voyage en Italie",
      type: "texte",
      couleur: "sauge",
    });
    expect(ecritures(fake.appels, "notes_tags", "delete")).toHaveLength(1);
    expect(ecritures(fake.appels, "notes_tags", "insert")[0].payload).toEqual([{ note_id: ID, tag_id: TAG1 }]);
    expect(etat.updateTag).toHaveBeenCalledWith("notes");
    expect(etat.revalidatePath).toHaveBeenCalledWith("/notes");
  });

  it("crée à la volée les nouveaux tags (dédoublonnés) et les rattache avec les existants", async () => {
    const fake = brancher((a) => {
      if (a.table === "notes" && a.action === "insert") return { data: { id: ID } };
      if (a.table === "tags" && a.action === "upsert") return { data: [{ id: "new-1" }, { id: "new-2" }] };
      return undefined;
    });

    await createNote({ error: null }, form({ ...texte, tag_ids: [TAG1], nouveaux_tags: "voyage, idée ,voyage," }));

    expect(ecritures(fake.appels, "tags", "upsert")[0].payload).toEqual([{ nom: "voyage" }, { nom: "idée" }]);
    expect(ecritures(fake.appels, "notes_tags", "insert")[0].payload).toEqual([
      { note_id: ID, tag_id: TAG1 },
      { note_id: ID, tag_id: "new-1" },
      { note_id: ID, tag_id: "new-2" },
    ]);
  });

  it("insère les éléments d'une checklist dans l'ordre du formulaire, en ignorant les vides", async () => {
    const fake = brancher((a) => (a.table === "notes" && a.action === "insert" ? { data: { id: ID } } : undefined));

    await createNote(
      { error: null },
      form({ titre: "Courses", type: "checklist", item_libelle: ["Lait", "  ", "Pain"] })
    );

    expect(ecritures(fake.appels, "note_items", "insert")[0].payload).toEqual([
      { note_id: ID, libelle: "Lait", position: 0 },
      { note_id: ID, libelle: "Pain", position: 1 },
    ]);
  });

  it("n'insère aucun élément pour une checklist vide, ni pour une note texte", async () => {
    const fake = brancher((a) => (a.table === "notes" && a.action === "insert" ? { data: { id: ID } } : undefined));
    await createNote({ error: null }, form({ titre: "Vide", type: "checklist" }));
    await createNote({ error: null }, form({ ...texte, item_libelle: "ignoré" }));
    expect(ecritures(fake.appels, "note_items")).toHaveLength(0);
  });

  it("remonte l'erreur d'insertion, de tags et d'éléments", async () => {
    brancher((a) => (a.table === "notes" ? { error: { message: "note ko" } } : undefined));
    expect(await createNote({ error: null }, form(texte))).toEqual({ error: "note ko" });

    brancher((a) => {
      if (a.table === "notes") return { data: { id: ID } };
      if (a.table === "notes_tags" && a.action === "delete") return { error: { message: "tags ko" } };
      return undefined;
    });
    expect(await createNote({ error: null }, form(texte))).toEqual({ error: "tags ko" });
    expect(etat.updateTag).not.toHaveBeenCalled();

    brancher((a) => {
      if (a.table === "notes") return { data: { id: ID } };
      if (a.table === "note_items") return { error: { message: "items ko" } };
      return undefined;
    });
    expect(await createNote({ error: null }, form({ titre: "C", type: "checklist", item_libelle: "x" }))).toEqual({
      error: "items ko",
    });
  });

  it("remonte l'erreur de création d'un nouveau tag", async () => {
    brancher((a) => {
      if (a.table === "notes") return { data: { id: ID } };
      if (a.table === "tags") return { error: { message: "upsert ko" } };
      return undefined;
    });
    expect(await createNote({ error: null }, form({ ...texte, nouveaux_tags: "x" }))).toEqual({ error: "upsert ko" });
  });
});

describe("updateNote", () => {
  it("refuse sans id et valide la saisie", async () => {
    brancher();
    expect(await updateNote({ error: null }, form(texte))).toEqual({ error: "Note introuvable." });
    expect(await updateNote({ error: null }, form({ ...texte, id: ID, titre: "" }))).toEqual({ error: "Le titre est requis." });
  });

  it("met à jour la note ciblée, remplace ses tags et expire le cache", async () => {
    const fake = brancher();
    expect(await updateNote({ error: null }, form({ ...texte, id: ID, tag_ids: [TAG1] }))).toEqual({ error: null });
    const [maj] = ecritures(fake.appels, "notes", "update");
    expect(maj.filtres).toContainEqual(["eq", "id", ID]);
    expect(ecritures(fake.appels, "notes_tags", "insert")[0].payload).toEqual([{ note_id: ID, tag_id: TAG1 }]);
    expect(etat.updateTag).toHaveBeenCalledWith("notes");
  });

  it("remonte l'erreur de mise à jour ou de tags", async () => {
    brancher((a) => (a.table === "notes" ? { error: { message: "maj ko" } } : undefined));
    expect(await updateNote({ error: null }, form({ ...texte, id: ID }))).toEqual({ error: "maj ko" });

    brancher((a) => (a.table === "notes_tags" && a.action === "delete" ? { error: { message: "tags ko" } } : undefined));
    expect(await updateNote({ error: null }, form({ ...texte, id: ID }))).toEqual({ error: "tags ko" });
  });
});

describe("écritures simples", () => {
  it("deleteNote, toggleEpingle et les items ciblent la bonne ligne et expirent le cache", async () => {
    const fake = brancher();
    await deleteNote(ID);
    await toggleEpingle(ID, true);
    await toggleNoteItem(ID, true);
    await deleteNoteItem(ID);
    await updateNoteItemLibelle(ID, "  Lait  ");

    expect(ecritures(fake.appels, "notes", "delete")[0].filtres).toContainEqual(["eq", "id", ID]);
    expect(ecritures(fake.appels, "notes", "update")[0].payload).toEqual({ epingle: true });
    expect(ecritures(fake.appels, "note_items", "update").map((m) => m.payload)).toEqual([{ coche: true }, { libelle: "Lait" }]);
    expect(ecritures(fake.appels, "note_items", "delete")).toHaveLength(1);
    expect(etat.updateTag).toHaveBeenCalledTimes(5);
  });

  it("lève l'erreur Supabase sans expirer le cache", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    await expect(deleteNote(ID)).rejects.toThrow("ko");
    await expect(toggleEpingle(ID, true)).rejects.toThrow("ko");
    await expect(toggleNoteItem(ID, true)).rejects.toThrow("ko");
    await expect(deleteNoteItem(ID)).rejects.toThrow("ko");
    await expect(updateNoteItemLibelle(ID, "x")).rejects.toThrow("ko");
    await expect(addNoteItem(ID, "x")).rejects.toThrow("ko");
    expect(etat.updateTag).not.toHaveBeenCalled();
  });

  it("refuse un libellé d'élément vide", async () => {
    const fake = brancher();
    await expect(addNoteItem(ID, " ")).rejects.toThrow("Le libellé de l'item est requis.");
    await expect(updateNoteItemLibelle(ID, "")).rejects.toThrow("Le libellé de l'item est requis.");
    expect(fake.appels).toHaveLength(0);
  });

  it("addNoteItem se place après le dernier élément", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { position: 6 } } : undefined));
    await addNoteItem(ID, " Beurre ");
    expect(ecritures(fake.appels, "note_items", "insert")[0].payload).toEqual({ note_id: ID, libelle: "Beurre", position: 7 });
  });

  it("addNoteItem démarre à la position 0 dans une note vide", async () => {
    const fake = brancher();
    await addNoteItem(ID, "Premier");
    expect(ecritures(fake.appels, "note_items", "insert")[0].payload).toMatchObject({ position: 0 });
  });
});

describe("reorderNoteItems", () => {
  const items = [{ id: "a", position: 0 }, { id: "b", position: 1 }, { id: "c", position: 2 }];

  it("échange la position avec l'élément voisin", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: items } : undefined));
    await reorderNoteItems(ID, "b", "bas");
    expect(ecritures(fake.appels, "note_items", "update").map((m) => [m.payload, m.filtres[0]])).toEqual([
      [{ position: 2 }, ["eq", "id", "b"]],
      [{ position: 1 }, ["eq", "id", "c"]],
    ]);
    expect(etat.updateTag).toHaveBeenCalledWith("notes");
  });

  it("ne fait rien aux extrémités ni pour un élément inconnu", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: items } : undefined));
    await reorderNoteItems(ID, "a", "haut");
    await reorderNoteItems(ID, "c", "bas");
    await reorderNoteItems(ID, "zzz", "haut");
    expect(ecritures(fake.appels, "note_items")).toHaveLength(0);
    expect(etat.updateTag).not.toHaveBeenCalled();
  });

  it("lève les erreurs de lecture et d'écriture", async () => {
    brancher(() => ({ error: { message: "lecture ko" } }));
    await expect(reorderNoteItems(ID, "b", "bas")).rejects.toThrow("lecture ko");
    brancher((a) => (a.action === "select" ? { data: items } : { error: { message: "maj ko" } }));
    await expect(reorderNoteItems(ID, "b", "bas")).rejects.toThrow("maj ko");
  });
});

describe("getNotesAvecRelations", () => {
  it("aplatit items et tags, et écarte les tags null", async () => {
    brancher(() => ({
      data: [
        {
          id: ID,
          titre: "Courses",
          note_items: [{ id: "i1", libelle: "Lait" }],
          notes_tags: [{ tag: { id: TAG1, nom: "maison" } }, { tag: null }],
        },
      ],
    }));

    const [note] = await getNotesAvecRelations();

    expect(note.items).toEqual([{ id: "i1", libelle: "Lait" }]);
    expect(note.tags).toEqual([{ id: TAG1, nom: "maison" }]);
    expect(note).not.toHaveProperty("note_items");
    expect(note).not.toHaveProperty("notes_tags");
  });

  it("renvoie [] sans données et lève sur erreur", async () => {
    brancher();
    expect(await getNotesAvecRelations()).toEqual([]);
    brancher(() => ({ error: { message: "ko" } }));
    await expect(getNotesAvecRelations()).rejects.toThrow("ko");
  });
});

describe("noteVersTache", () => {
  const listeEtOrdre = (a: { table: string; action: string }) => {
    if (a.table === "listes_taches") return { data: { id: "L1" } };
    if (a.table === "taches" && a.action === "insert") return { data: { id: "T1" } };
    return undefined;
  };

  it("refuse un id invalide ou une note absente", async () => {
    brancher();
    expect(await noteVersTache("x")).toEqual({ ok: false, error: "Note introuvable." });
    expect(await noteVersTache(ID)).toEqual({ ok: false, error: "Note introuvable." });
  });

  it("remonte l'erreur de lecture", async () => {
    brancher(() => ({ error: { message: "ko" } }));
    expect(await noteVersTache(ID)).toEqual({ ok: false, error: "ko" });
  });

  it("reprend titre et contenu d'une note texte et garde le lien vers la note", async () => {
    const fake = brancher((a) =>
      a.table === "notes" ? { data: { titre: "Appeler", contenu: "Le plombier", type: "texte", note_items: [] } } : listeEtOrdre(a)
    );

    expect(await noteVersTache(ID)).toEqual({ ok: true, data: { id: "T1" } });
    expect(ecritures(fake.appels, "taches", "insert")[0].payload).toMatchObject({
      titre: "Appeler",
      notes: "Le plombier",
      note_id: ID,
    });
    expect(etat.revalidateTag).toHaveBeenCalledWith("taches", { expire: 0 });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/taches");
  });

  it("transforme les éléments restants d'une checklist, dans l'ordre, en liste de notes", async () => {
    const fake = brancher((a) =>
      a.table === "notes"
        ? {
            data: {
              titre: "Voyage",
              contenu: "",
              type: "checklist",
              note_items: [
                { libelle: "Billets", coche: false, position: 2 },
                { libelle: "Passeport", coche: true, position: 0 },
                { libelle: "Valise", coche: false, position: 1 },
              ],
            },
          }
        : listeEtOrdre(a)
    );

    await noteVersTache(ID);

    expect(ecritures(fake.appels, "taches", "insert")[0].payload).toMatchObject({ notes: "- Valise\n- Billets" });
  });

  it("n'expire pas le cache des tâches quand la création échoue", async () => {
    brancher((a) => (a.table === "notes" ? { data: { titre: "x", contenu: "y", type: "texte", note_items: [] } } : undefined));
    expect(await noteVersTache(ID)).toEqual({ ok: false, error: "Crée d'abord une liste de tâches." });
    expect(etat.revalidateTag).not.toHaveBeenCalled();
  });
});

describe("noteItemVersTache", () => {
  it("refuse un id invalide, un élément absent ou une erreur de lecture", async () => {
    brancher();
    expect(await noteItemVersTache("x")).toEqual({ ok: false, error: "Élément introuvable." });
    expect(await noteItemVersTache(ID)).toEqual({ ok: false, error: "Élément introuvable." });
    brancher(() => ({ error: { message: "ko" } }));
    expect(await noteItemVersTache(ID)).toEqual({ ok: false, error: "ko" });
  });

  it("crée la tâche en citant la note d'origine", async () => {
    const fake = brancher((a) => {
      if (a.table === "note_items") return { data: { libelle: "Acheter du lait", note_id: "N1", note: { titre: "Courses" } } };
      if (a.table === "listes_taches") return { data: { id: "L1" } };
      if (a.table === "taches" && a.action === "insert") return { data: { id: "T1" } };
      return undefined;
    });

    expect(await noteItemVersTache(ID)).toEqual({ ok: true, data: { id: "T1" } });
    expect(ecritures(fake.appels, "taches", "insert")[0].payload).toMatchObject({
      titre: "Acheter du lait",
      notes: "Depuis la note « Courses »",
      note_id: "N1",
    });
  });

  it("n'ajoute pas de mention quand la note d'origine a disparu", async () => {
    const fake = brancher((a) => {
      if (a.table === "note_items") return { data: { libelle: "Orphelin", note_id: "N1", note: null } };
      if (a.table === "listes_taches") return { data: { id: "L1" } };
      if (a.table === "taches" && a.action === "insert") return { data: { id: "T1" } };
      return undefined;
    });
    await noteItemVersTache(ID);
    expect(ecritures(fake.appels, "taches", "insert")[0].payload).toMatchObject({ notes: null });
  });
});
