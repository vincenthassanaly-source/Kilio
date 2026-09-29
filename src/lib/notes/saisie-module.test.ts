import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementACreer } from "@/lib/saisie-ia/types";

vi.mock("@/app/actions/notes", () => ({ createNote: vi.fn() }));
vi.mock("@/app/actions/taches", () => ({ getTags: vi.fn() }));
import { createNote } from "@/app/actions/notes";
import { moduleNotes } from "./saisie-module";
import type { NotePropose } from "./saisie-naturelle";

const creer = vi.mocked(createNote);
const note = (surcharge: Partial<NotePropose> = {}) =>
  ({
    type: "note",
    donnees: {
      titre: "Idée cadeau",
      type: "texte",
      contenu: "Un livre",
      items: [],
      tagIds: ["t1"],
      nouveauxTags: ["noël, fêtes"],
      tagNoms: [],
      avertissements: [],
      ...surcharge,
    },
  }) as ElementACreer;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("moduleNotes.creer", () => {
  it("passe par createNote avec les mêmes champs que le formulaire manuel", async () => {
    creer.mockResolvedValue({ error: null });

    const issues = await moduleNotes.creer([note()]);

    expect(issues).toEqual([{ ok: true }]);
    const formData = creer.mock.calls[0][1];
    expect(formData.get("titre")).toBe("Idée cadeau");
    expect(formData.get("type")).toBe("texte");
    expect(formData.get("contenu")).toBe("Un livre");
    expect(formData.getAll("tag_ids")).toEqual(["t1"]);
    // Virgule retirée : createNote découpe les nouveaux tags sur ce signe.
    expect(formData.get("nouveaux_tags")).toBe("noël  fêtes");
    expect(formData.getAll("item_libelle")).toEqual([]);
  });

  it("envoie les items d'une checklist et aucun contenu", async () => {
    creer.mockResolvedValue({ error: null });

    await moduleNotes.creer([note({ type: "checklist", contenu: "ignoré", items: ["Chargeur", "Passeport"] })]);

    const formData = creer.mock.calls[0][1];
    expect(formData.get("contenu")).toBe("");
    expect(formData.getAll("item_libelle")).toEqual(["Chargeur", "Passeport"]);
  });

  it("rend l'erreur de createNote pour la note concernée sans arrêter les suivantes", async () => {
    creer.mockResolvedValueOnce({ error: "Le titre est requis." }).mockResolvedValueOnce({ error: null });

    const issues = await moduleNotes.creer([note({ titre: "" }), note()]);

    expect(issues).toEqual([{ ok: false, message: "Le titre est requis." }, { ok: true }]);
  });

  it("attrape une exception inattendue", async () => {
    creer.mockRejectedValue(new Error("boom"));
    expect(await moduleNotes.creer([note()])).toEqual([{ ok: false, message: "La note n'a pas pu être créée. Réessaie." }]);
  });
});
