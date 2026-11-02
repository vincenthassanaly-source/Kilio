import { describe, expect, it } from "vitest";
import {
  CONTENU_MAX,
  TITRE_MAX,
  lireReformulation,
  lireResume,
  lireTags,
  nettoyerContenu,
  nettoyerNomTag,
  nettoyerTitre,
  texteDeNote,
} from "./assistant";

const TAGS = [
  { id: "t1", nom: "Santé" },
  { id: "t2", nom: "travail" },
  { id: "t3", nom: "idées" },
];

describe("nettoyerTitre", () => {
  it("retire guillemets et point final, sur une ligne", () => {
    expect(nettoyerTitre("« Liste de courses. »")).toBe("Liste de courses");
    expect(nettoyerTitre('  "Rendez-vous\n médecin"  ')).toBe("Rendez-vous médecin");
  });

  it("coupe un titre trop long", () => {
    expect(nettoyerTitre("a".repeat(200)).length).toBe(TITRE_MAX);
  });
});

describe("lireResume", () => {
  it("lit titre et résumé", () => {
    expect(lireResume({ titre: "Idée app", resume: "Une  idée\nd'application." })).toEqual({
      mode: "resume",
      titre: "Idée app",
      resume: "Une idée d'application.",
    });
  });

  it("refuse une réponse vide ou invalide", () => {
    expect(lireResume({ titre: "", resume: " " })).toBeNull();
    expect(lireResume(null)).toBeNull();
    expect(lireResume("texte")).toBeNull();
  });
});

describe("lireReformulation", () => {
  it("garde les retours à la ligne et supprime les blancs superflus", () => {
    expect(nettoyerContenu("Ligne 1  \r\n\r\n\r\n\r\nLigne 2\t\n")).toBe("Ligne 1\n\nLigne 2");
    expect(lireReformulation({ contenu: "- a\n- b" })).toEqual({ mode: "reformuler", contenu: "- a\n- b" });
  });

  it("refuse un texte vide ou trop long", () => {
    expect(lireReformulation({ contenu: "  " })).toBeNull();
    expect(lireReformulation({ contenu: "a".repeat(CONTENU_MAX + 1) })).toBeNull();
    expect(lireReformulation({})).toBeNull();
  });
});

describe("nettoyerNomTag", () => {
  it("retire le # et passe en minuscules", () => {
    expect(nettoyerNomTag("  #Voyage  ")).toBe("voyage");
  });
});

describe("lireTags", () => {
  it("garde les tags existants reconnus (accents et casse ignorés) et les nouveaux", () => {
    expect(lireTags({ existants: ["sante", "#Travail"], nouveaux: ["Voyage"] }, TAGS, [])).toEqual({
      mode: "tags",
      existants: [
        { id: "t1", nom: "Santé" },
        { id: "t2", nom: "travail" },
      ],
      nouveaux: ["voyage"],
    });
  });

  it("écarte un tag inconnu ou déjà sur la note", () => {
    expect(lireTags({ existants: ["inconnu", "travail"], nouveaux: [] }, TAGS, ["t2"])).toBeNull();
  });

  it("transforme un « nouveau » qui existe déjà en existant, sans doublon", () => {
    expect(lireTags({ existants: ["idées"], nouveaux: ["Idées", "idees"] }, TAGS, [])).toEqual({
      mode: "tags",
      existants: [{ id: "t3", nom: "idées" }],
      nouveaux: [],
    });
  });

  it("limite à 3 nouveaux tags et ignore les vides", () => {
    const r = lireTags({ existants: [], nouveaux: ["a", "b", "", "c", "d"] }, [], []);
    expect(r?.nouveaux).toEqual(["a", "b", "c"]);
  });

  it("renvoie null sans aucune proposition utilisable", () => {
    expect(lireTags({ existants: [], nouveaux: [] }, TAGS, [])).toBeNull();
    expect(lireTags(undefined, TAGS, [])).toBeNull();
  });
});

describe("texteDeNote", () => {
  it("renvoie le contenu d'une note texte", () => {
    expect(texteDeNote({ type: "texte", contenu: "  Bonjour  ", items: [] })).toBe("Bonjour");
  });

  it("liste les éléments d'une checklist dans l'ordre, avec leur état", () => {
    expect(
      texteDeNote({
        type: "checklist",
        contenu: "",
        items: [
          { libelle: "Lait", coche: true, position: 1 },
          { libelle: "Pain", coche: false, position: 0 },
        ],
      })
    ).toBe("- [ ] Pain\n- [x] Lait");
  });
});
