// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase, type Repondre } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, gemini: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));
vi.mock("@/lib/gemini/appel", () => ({ appelerGemini: etat.gemini, MESSAGE_QUOTA_GEMINI: "Quota atteint." }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }));

import { appliquerPropositionNote, proposerPourNote } from "./notes-assistant";

const ID = "11111111-1111-4111-8111-111111111111";
const TAG_A = "22222222-2222-4222-8222-222222222222";
const TAG_B = "33333333-3333-4333-8333-333333333333";

type OptionsNote = { note?: unknown; tags?: unknown; notesTags?: unknown; erreurNote?: boolean; erreurEcriture?: boolean };

function brancher(options: OptionsNote = {}) {
  const repondre: Repondre = (a) => {
    if (a.table === "notes") {
      if (a.action === "update") return options.erreurEcriture ? { error: { message: "boom" } } : {};
      if (options.erreurNote) return { error: { message: "boom" } };
      return {
        data:
          "note" in options
            ? options.note
            : { titre: "Idée", contenu: "acheter du lait et du pain", type: "texte", note_items: [], notes_tags: [] },
      };
    }
    if (a.table === "tags") {
      if (a.action === "upsert") return { data: [{ id: TAG_B }] };
      return { data: options.tags ?? [{ id: TAG_A, nom: "courses" }] };
    }
    if (a.table === "notes_tags") {
      if (a.action === "select") return { data: options.notesTags ?? [] };
      return {};
    }
    return undefined;
  };
  const fake = fauxSupabase(repondre);
  etat.client = fake.client;
  return fake;
}

beforeEach(() => {
  etat.gemini.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("proposerPourNote", () => {
  it("refuse un identifiant ou un mode invalide", async () => {
    brancher();
    expect((await proposerPourNote("nope", "resume")).ok).toBe(false);
    expect((await proposerPourNote(ID, "autre" as never)).ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("propose un résumé sans rien écrire", async () => {
    const fake = brancher();
    etat.gemini.mockResolvedValue({ ok: true, brut: { titre: "Courses", resume: "Acheter du lait et du pain." } });

    const r = await proposerPourNote(ID, "resume", true);

    expect(r).toEqual({ ok: true, data: { mode: "resume", titre: "Courses", resume: "Acheter du lait et du pain." } });
    expect(fake.appels.some((a) => a.action !== "select")).toBe(false);
  });

  it("réutilise le résultat gardé sans rappeler Gemini, sauf si on régénère", async () => {
    brancher({ note: { titre: "Cache", contenu: "texte stable", type: "texte", note_items: [], notes_tags: [] } });
    etat.gemini.mockResolvedValue({ ok: true, brut: { titre: "Cache", resume: "Un résumé." } });

    await proposerPourNote(ID, "resume");
    await proposerPourNote(ID, "resume");
    expect(etat.gemini).toHaveBeenCalledTimes(1);

    await proposerPourNote(ID, "resume", true);
    expect(etat.gemini).toHaveBeenCalledTimes(2);
  });

  it("n'accepte la reformulation que pour une note texte", async () => {
    brancher({
      note: { titre: "Liste", contenu: "", type: "checklist", note_items: [{ libelle: "a", coche: false, position: 0 }], notes_tags: [] },
    });
    const r = await proposerPourNote(ID, "reformuler");
    expect(r.ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("refuse une note vide", async () => {
    brancher({ note: { titre: "Vide", contenu: "   ", type: "texte", note_items: [], notes_tags: [] } });
    const r = await proposerPourNote(ID, "resume");
    expect(r.ok).toBe(false);
    expect(etat.gemini).not.toHaveBeenCalled();
  });

  it("signale une note disparue", async () => {
    brancher({ note: null });
    const r = await proposerPourNote(ID, "resume");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("n'existe plus");
  });

  it("propose des tags existants et nouveaux, en écartant les tags déjà posés", async () => {
    brancher({
      note: {
        titre: "Courses",
        contenu: "lait",
        type: "texte",
        note_items: [],
        notes_tags: [{ tag_id: "deja", tag: { nom: "perso" } }],
      },
      tags: [
        { id: TAG_A, nom: "courses" },
        { id: "deja", nom: "perso" },
      ],
    });
    etat.gemini.mockResolvedValue({ ok: true, brut: { existants: ["courses", "perso"], nouveaux: ["cuisine"] } });

    const r = await proposerPourNote(ID, "tags", true);

    expect(r).toEqual({
      ok: true,
      data: { mode: "tags", existants: [{ id: TAG_A, nom: "courses" }], nouveaux: ["cuisine"] },
    });
  });

  it("renvoie le message de quota quand Gemini répond 429", async () => {
    brancher();
    etat.gemini.mockResolvedValue({ ok: false, code: "quota", detail: "429" });
    expect(await proposerPourNote(ID, "reformuler", true)).toEqual({ ok: false, error: "Quota atteint." });
  });

  it("explique l'échec de Gemini et refuse une réponse inutilisable", async () => {
    brancher();
    etat.gemini.mockResolvedValueOnce({ ok: false, code: "echec", detail: "Délai dépassé." });
    const r1 = await proposerPourNote(ID, "reformuler", true);
    expect(r1.ok).toBe(false);
    expect(r1.error).toContain("Délai dépassé.");

    etat.gemini.mockResolvedValueOnce({ ok: true, brut: { contenu: "" } });
    const r2 = await proposerPourNote(ID, "reformuler", true);
    expect(r2.ok).toBe(false);
    expect(r2.error).toContain("inutilisable");
  });
});

describe("appliquerPropositionNote", () => {
  it("applique le titre et ajoute le résumé en tête du contenu", async () => {
    const fake = brancher({ note: { contenu: "texte", type: "texte" } });
    const r = await appliquerPropositionNote(ID, { mode: "resume", titre: "« Nouveau titre. »", resume: "Résumé." });
    expect(r.ok).toBe(true);
    expect(fake.appels).toContainEqual(
      expect.objectContaining({
        table: "notes",
        action: "update",
        payload: { titre: "Nouveau titre", contenu: "Résumé.\n\ntexte" },
      })
    );
  });

  it("refuse d'ajouter un résumé à une checklist", async () => {
    const fake = brancher({ note: { contenu: "", type: "checklist" } });
    const r = await appliquerPropositionNote(ID, { mode: "resume", resume: "Résumé." });
    expect(r.ok).toBe(false);
    expect(fake.appels.some((a) => a.action === "update")).toBe(false);
  });

  it("refuse une application sans changement", async () => {
    brancher();
    expect((await appliquerPropositionNote(ID, { mode: "resume" })).ok).toBe(false);
  });

  it("remplace le contenu par le texte reformulé", async () => {
    const fake = brancher({ note: { contenu: "vieux", type: "texte" } });
    const r = await appliquerPropositionNote(ID, { mode: "reformuler", contenu: "  Nouveau texte.  " });
    expect(r.ok).toBe(true);
    expect(fake.appels).toContainEqual(
      expect.objectContaining({ table: "notes", action: "update", payload: { contenu: "Nouveau texte." } })
    );
  });

  it("refuse une reformulation vide ou sur une checklist", async () => {
    brancher({ note: { contenu: "x", type: "texte" } });
    expect((await appliquerPropositionNote(ID, { mode: "reformuler", contenu: "  " })).ok).toBe(false);
    brancher({ note: { contenu: "", type: "checklist" } });
    expect((await appliquerPropositionNote(ID, { mode: "reformuler", contenu: "x" })).ok).toBe(false);
  });

  it("remonte une erreur d'écriture", async () => {
    brancher({ note: { contenu: "x", type: "texte" }, erreurEcriture: true });
    expect((await appliquerPropositionNote(ID, { mode: "reformuler", contenu: "y" })).ok).toBe(false);
  });

  it("ajoute les tags choisis et crée les nouveaux, sans retirer ni dupliquer", async () => {
    const fake = brancher({
      note: { contenu: "x", type: "texte" },
      tags: [{ id: TAG_A }],
      notesTags: [{ tag_id: TAG_A }],
    });
    const r = await appliquerPropositionNote(ID, { mode: "tags", tagIds: [TAG_A, "pas-un-uuid"], nouveaux: ["#Voyage"] });
    expect(r.ok).toBe(true);
    expect(fake.appels).toContainEqual(
      expect.objectContaining({ table: "tags", action: "upsert", payload: [{ nom: "voyage" }] })
    );
    expect(fake.appels).toContainEqual(
      expect.objectContaining({ table: "notes_tags", action: "insert", payload: [{ note_id: ID, tag_id: TAG_B }] })
    );
    expect(fake.appels.some((a) => a.table === "notes_tags" && a.action === "delete")).toBe(false);
  });

  it("refuse une application de tags vide", async () => {
    brancher();
    expect((await appliquerPropositionNote(ID, { mode: "tags", tagIds: [], nouveaux: [] })).ok).toBe(false);
  });

  it("refuse un identifiant de note invalide ou une note disparue", async () => {
    brancher();
    expect((await appliquerPropositionNote("nope", { mode: "resume", titre: "x" })).ok).toBe(false);
    brancher({ note: null });
    expect((await appliquerPropositionNote(ID, { mode: "resume", titre: "x" })).ok).toBe(false);
  });
});
