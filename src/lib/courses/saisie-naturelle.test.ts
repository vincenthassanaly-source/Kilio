import { describe, expect, it } from "vitest";
import { interpreterCourses, lignesContexteCourses, type ArticleConnu } from "./saisie-naturelle";

const existants: ArticleConnu[] = [
  { id: "a1", libelle: "Lait", coche: false },
  { id: "a2", libelle: "Pain", coche: true },
];

describe("interpreterCourses", () => {
  it("garde les libellés propres, sans avertissement pour un article nouveau", () => {
    expect(interpreterCourses([{ libelle: "  6   œufs " }], existants)).toEqual([
      { libelle: "6 œufs", avertissements: [] },
    ]);
  });

  it("écarte les entrées sans libellé", () => {
    expect(interpreterCourses([{ libelle: "" }, { libelle: 3 }, {}, { libelle: "Beurre" }], existants)).toHaveLength(1);
  });

  it("prévient qu'un article actif de la liste ne sera pas ajouté deux fois (sans accents ni casse)", () => {
    const [lait] = interpreterCourses([{ libelle: "LAIT" }], existants);
    expect(lait.avertissements.join(" ")).toMatch(/Déjà dans la liste/);
  });

  it("prévient qu'un article archivé sera remis dans la liste", () => {
    const [pain] = interpreterCourses([{ libelle: "pain" }], existants);
    expect(pain.avertissements.join(" ")).toMatch(/remis dans la liste/);
  });

  it("signale le doublon interne d'un lot", () => {
    const r = interpreterCourses([{ libelle: "Beurre" }, { libelle: "beurre" }], existants);
    expect(r[0].avertissements).toEqual([]);
    expect(r[1].avertissements.join(" ")).toMatch(/Déjà dans la liste/);
  });

  it("borne la longueur d'un libellé", () => {
    const [long] = interpreterCourses([{ libelle: "x".repeat(300) }], existants);
    expect(long.libelle).toHaveLength(100);
  });
});

describe("lignesContexteCourses", () => {
  it("ne cite que les articles encore actifs", () => {
    expect(lignesContexteCourses(existants)[0]).toContain('["Lait"]');
  });
});
