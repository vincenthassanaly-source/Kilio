import { describe, expect, it } from "vitest";
import { calculerProfil, decrireMoyenne, sujetsACreuser, trouverTensions, type IdeePourProfil } from "./profil";
import { AXES, scoresVides, type Scores } from "./types";

function idee(id: string, surcharge: Partial<Omit<IdeePourProfil, "scores">> & { scores?: Partial<Scores> } = {}): IdeePourProfil {
  const { scores, ...reste } = surcharge;
  return {
    id,
    position: `Idée ${id}`,
    statut: "validee",
    theme: "economie",
    conviction: "plutot",
    ...reste,
    scores: { ...scoresVides(), ...scores },
  };
}

const economique = AXES[0];

describe("calculerProfil", () => {
  it("renvoie un profil vide sans idée validée", () => {
    const profil = calculerProfil([idee("a", { statut: "brouillon", scores: { economique: 2 } })]);
    expect(profil).toHaveLength(AXES.length);
    expect(profil.every((p) => p.moyenne === null && p.nombre === 0)).toBe(true);
  });

  it("ne compte que les idées validées ayant un score sur l'axe", () => {
    const profil = calculerProfil([
      idee("a", { scores: { economique: -2 } }),
      idee("b", { scores: { economique: 0 } }),
      idee("c", { scores: { societal: 1 } }),
      idee("d", { statut: "rejetee", scores: { economique: 2 } }),
    ]);
    const eco = profil.find((p) => p.axe.id === "economique");
    expect(eco).toMatchObject({ moyenne: -1, nombre: 2 });
    expect(profil.find((p) => p.axe.id === "societal")).toMatchObject({ moyenne: 1, nombre: 1 });
    expect(profil.find((p) => p.axe.id === "ecologie")).toMatchObject({ moyenne: null, nombre: 0 });
  });

  it("pondère par la conviction", () => {
    const profil = calculerProfil([
      idee("a", { conviction: "certain", scores: { economique: 2 } }),
      idee("b", { conviction: "hesitant", scores: { economique: -2 } }),
    ]);
    // (2 × 1,5 + -2 × 0,5) / (1,5 + 0,5) = 1
    expect(profil[0].moyenne).toBeCloseTo(1);
  });
});

describe("decrireMoyenne", () => {
  it("nomme le pôle et l'intensité", () => {
    expect(decrireMoyenne(economique, null)).toBe("Pas encore de position");
    expect(decrireMoyenne(economique, 0.2)).toBe("Équilibré");
    expect(decrireMoyenne(economique, -0.8)).toBe("Plutôt État");
    expect(decrireMoyenne(economique, 1.5)).toBe("Nettement Marché");
  });
});

describe("sujetsACreuser", () => {
  it("liste les thèmes sans idée validée, avec les brouillons en attente", () => {
    const sujets = sujetsACreuser([
      idee("a", { theme: "economie" }),
      idee("b", { statut: "brouillon", theme: "sante" }),
      idee("c", { statut: "brouillon", theme: "sante" }),
      idee("d", { statut: "brouillon", theme: null }),
    ]);
    expect(sujets.find((s) => s.theme === "economie")).toBeUndefined();
    expect(sujets.find((s) => s.theme === "sante")).toEqual({ theme: "sante", brouillons: 2 });
    expect(sujets.find((s) => s.theme === "culture")).toEqual({ theme: "culture", brouillons: 0 });
  });
});

describe("trouverTensions", () => {
  it("repère deux idées validées d'un même thème qui s'opposent sur un axe", () => {
    const tensions = trouverTensions([
      idee("a", { scores: { economique: -2 } }),
      idee("b", { scores: { economique: 2 } }),
    ]);
    expect(tensions).toHaveLength(1);
    expect(tensions[0]).toMatchObject({ axe: "economique", theme: "economie", ecart: 4 });
  });

  it("ignore les thèmes différents, les écarts faibles, les brouillons et les axes non notés", () => {
    expect(
      trouverTensions([
        idee("a", { theme: "economie", scores: { economique: -2 } }),
        idee("b", { theme: "sante", scores: { economique: 2 } }),
        idee("c", { theme: "economie", scores: { economique: 0 } }),
        idee("d", { theme: "economie", statut: "brouillon", scores: { economique: 2 } }),
        idee("e", { theme: "economie", scores: { societal: 2 } }),
      ])
    ).toEqual([]);
  });

  it("trie par écart décroissant et borne le résultat", () => {
    const idees = [
      idee("a", { scores: { economique: -2, societal: -1 } }),
      idee("b", { scores: { economique: 2, societal: 2 } }),
    ];
    const tensions = trouverTensions(idees, 1);
    expect(tensions).toHaveLength(1);
    expect(tensions[0].ecart).toBe(4);
  });
});
