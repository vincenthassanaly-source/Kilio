import { describe, expect, it } from "vitest";
import { parseNoteInput, titreNote, TITRE_LISTE_SANS_TITRE } from "./saisie";

function form(champs: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

describe("parseNoteInput", () => {
  it("exige un titre pour une note texte", () => {
    expect(parseNoteInput(form({ type: "texte", titre: " ", contenu: "x" }))).toEqual({
      ok: false,
      error: "Le titre est requis.",
    });
  });

  it("accepte une checklist sans titre (titre enregistré vide)", () => {
    const r = parseNoteInput(form({ type: "checklist", titre: "  " }));
    expect(r).toEqual({ ok: true, value: { titre: "", contenu: "", type: "checklist", couleur: null } });
  });

  it("exige un contenu pour une note texte", () => {
    expect(parseNoteInput(form({ type: "texte", titre: "Idée" }))).toEqual({ ok: false, error: "Le contenu est requis." });
  });

  it("refuse un type ou une couleur inconnus", () => {
    expect(parseNoteInput(form({ type: "autre", titre: "a" })).ok).toBe(false);
    expect(parseNoteInput(form({ type: "checklist", couleur: "fuchsia" })).ok).toBe(false);
  });
});

describe("titreNote", () => {
  it("rend le titre, ou le repli d'une liste sans titre", () => {
    expect(titreNote({ titre: "Courses" })).toBe("Courses");
    expect(titreNote({ titre: "" })).toBe(TITRE_LISTE_SANS_TITRE);
  });
});
