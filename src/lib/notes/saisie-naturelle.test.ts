import { describe, expect, it } from "vitest";
import { interpreterNotes, type TagConnuNote } from "./saisie-naturelle";

const tags: TagConnuNote[] = [{ id: "t-idees", nom: "idées" }];

function premiere(brut: Record<string, unknown>) {
  const [note] = interpreterNotes([brut], tags);
  return note;
}

describe("interpreterNotes", () => {
  it("valide une note texte avec un tag existant et un nouveau", () => {
    expect(
      premiere({ titre: "Idée cadeau", type: "texte", contenu: "Un livre\nde cuisine", items: [], tags: ["Idées", "#noël, fêtes"] })
    ).toMatchObject({
      titre: "Idée cadeau",
      type: "texte",
      contenu: "Un livre\nde cuisine",
      items: [],
      tagIds: ["t-idees"],
      nouveauxTags: ["noël fêtes"],
      avertissements: [],
    });
  });

  it("valide une checklist et vide son contenu", () => {
    expect(premiere({ titre: "Valise", type: "checklist", contenu: "ignoré", items: ["Chargeur", " ", "Passeport"], tags: [] })).toMatchObject({
      type: "checklist",
      contenu: "",
      items: ["Chargeur", "Passeport"],
    });
  });

  it("passe une checklist sans item en note texte", () => {
    expect(premiere({ titre: "Mémo", type: "checklist", contenu: "Appeler Paul", items: [], tags: [] })).toMatchObject({
      type: "texte",
      contenu: "Appeler Paul",
      avertissements: [],
    });
  });

  it("passe une note texte sans contenu mais avec des items en checklist", () => {
    expect(premiere({ titre: "Courses idées", type: "texte", contenu: "", items: ["a", "b"], tags: [] })).toMatchObject({
      type: "checklist",
      items: ["a", "b"],
    });
  });

  it("reprend le titre comme contenu quand il n'y a rien d'autre, et le dit", () => {
    const n = premiere({ titre: "Penser à la mutuelle", type: "texte", contenu: "", items: [], tags: [] });
    expect(n.contenu).toBe("Penser à la mutuelle");
    expect(n.avertissements.join(" ")).toMatch(/Aucun contenu proposé/);
  });

  it("écarte une note sans titre et retombe sur « texte » pour un type inconnu", () => {
    expect(interpreterNotes([{ titre: "  ", type: "texte", contenu: "x", items: [], tags: [] }], tags)).toEqual([]);
    expect(premiere({ titre: "N", type: "autre", contenu: "x", items: [], tags: [] }).type).toBe("texte");
  });

  it("dédoublonne les tags et plafonne à 5", () => {
    const n = premiere({ titre: "N", type: "texte", contenu: "x", items: [], tags: ["a", "A", "b", "c", "d", "e", "f"] });
    expect(n.tagNoms).toEqual(["a", "b", "c", "d", "e"]);
  });
});
