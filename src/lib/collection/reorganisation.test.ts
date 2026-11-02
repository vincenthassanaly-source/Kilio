import { describe, expect, it } from "vitest";
import {
  collectionsVidees,
  construirePromptReorganisationCollections,
  estLisible,
  lireReponseReorganisationCollections,
  nbChangements,
  regrouperDeplacements,
  type CollectionPourReorganisation,
  type ElementPourReorganisation,
} from "./reorganisation";

const COLLECTIONS: CollectionPourReorganisation[] = [
  { id: "c1", nom: "Recettes", nbElements: 2 },
  { id: "c2", nom: "Cuisine", nbElements: 1 },
  { id: "c3", nom: "Divers", nbElements: 3 },
];

const el = (id: string, titre: string, collectionId: string): ElementPourReorganisation => ({
  id,
  titre,
  description: null,
  type: "photo",
  collectionId,
});

const ELEMENTS = [el("e1", "Gratin", "c3"), el("e2", "Tarte", "c3"), el("e3", "Canapé", "c3"), el("e4", "Soupe", "c1")];

const lire = (brut: unknown) => lireReponseReorganisationCollections(brut, ELEMENTS, COLLECTIONS);

describe("déplacements", () => {
  it("reconnaît une collection existante malgré la casse et les accents", () => {
    const r = lire({ deplacements: [{ i: 1, collection: "RECETTES" }], fusions: [], renommages: [] });
    expect(r.deplacements).toEqual([
      { id: "e1", titre: "Gratin", deId: "c3", deNom: "Divers", versId: "c1", versNom: "Recettes" },
    ]);
  });

  it("propose une nouvelle collection et unifie deux noms de même sens", () => {
    const r = lire({
      deplacements: [
        { i: 3, collection: "Idées déco" },
        { i: 2, collection: "idees deco" },
      ],
      fusions: [],
      renommages: [],
    });
    expect(r.deplacements.map((d) => [d.versId, d.versNom])).toEqual([
      [null, "Idées déco"],
      [null, "Idées déco"],
    ]);
  });

  it("ignore les numéros inconnus ou répétés, les noms vides et les éléments déjà bien rangés", () => {
    const r = lire({
      deplacements: [
        { i: 99, collection: "Recettes" },
        { i: 1, collection: "Recettes" },
        { i: 1, collection: "Cuisine" },
        { i: 2, collection: "  " },
        { i: 4, collection: "Recettes" },
        { i: "3", collection: "Recettes" },
      ],
      fusions: [],
      renommages: [],
    });
    expect(r.deplacements.map((d) => d.id)).toEqual(["e1"]);
    expect(r.deplacements[0].versId).toBe("c1");
  });

  it("redirige une destination fusionnée vers sa cible", () => {
    const r = lire({
      deplacements: [{ i: 1, collection: "Cuisine" }],
      fusions: [{ de: 2, vers: 1 }],
      renommages: [],
    });
    expect(r.deplacements[0]).toMatchObject({ versId: "c1", versNom: "Recettes" });
  });

  it("n'ajoute pas de déplacement redondant avec une fusion", () => {
    const r = lire({
      deplacements: [{ i: 4, collection: "Cuisine" }],
      fusions: [{ de: 1, vers: 2 }],
      renommages: [],
    });
    expect(r.deplacements).toEqual([]);
  });

  it("reconnaît le nouveau nom d'une collection renommée", () => {
    const r = lire({
      deplacements: [{ i: 1, collection: "Plats" }],
      fusions: [],
      renommages: [{ numero: 1, nom: "Plats" }],
    });
    expect(r.deplacements[0]).toMatchObject({ versId: "c1", versNom: "Plats" });
  });
});

describe("fusions", () => {
  it("garde les fusions valides avec l'effectif de la source", () => {
    const r = lire({ deplacements: [], fusions: [{ de: 2, vers: 1 }], renommages: [] });
    expect(r.fusions).toEqual([{ deId: "c2", deNom: "Cuisine", versId: "c1", versNom: "Recettes", nbElements: 1 }]);
  });

  it("écarte les auto-fusions, les numéros invalides, les doublons de source et les chaînes", () => {
    const r = lire({
      deplacements: [],
      fusions: [
        { de: 1, vers: 1 },
        { de: 9, vers: 1 },
        { de: 2, vers: 1 },
        { de: 2, vers: 3 },
        { de: 3, vers: 2 },
      ],
      renommages: [],
    });
    // 2→1 gagne pour la source 2 ; 3→2 est écarté car 2 est une source (chaîne).
    expect(r.fusions.map((f) => [f.deId, f.versId])).toEqual([["c2", "c1"]]);
  });
});

describe("renommages", () => {
  it("garde un renommage utile", () => {
    const r = lire({ deplacements: [], fusions: [], renommages: [{ numero: 3, nom: "Maison" }] });
    expect(r.renommages).toEqual([{ id: "c3", de: "Divers", vers: "Maison" }]);
  });

  it("écarte un nom identique, déjà pris, vide, ou une collection fusionnée", () => {
    const r = lire({
      deplacements: [],
      fusions: [{ de: 2, vers: 1 }],
      renommages: [
        { numero: 1, nom: "recettes" },
        { numero: 3, nom: "Cuisine" },
        { numero: 3, nom: "   " },
        { numero: 2, nom: "Autre" },
        { numero: 7, nom: "Hors liste" },
      ],
    });
    expect(r.renommages).toEqual([]);
  });

  it("écarte un second renommage vers un nom déjà attribué", () => {
    const r = lire({
      deplacements: [],
      fusions: [],
      renommages: [
        { numero: 3, nom: "Maison" },
        { numero: 2, nom: "maison" },
      ],
    });
    expect(r.renommages.map((x) => x.id)).toEqual(["c3"]);
  });
});

describe("réponse illisible", () => {
  it("renvoie une proposition vide", () => {
    for (const brut of [null, "texte", 42, {}, { deplacements: "x", fusions: 1, renommages: null }]) {
      expect(nbChangements(lire(brut))).toBe(0);
    }
  });
});

describe("regrouperDeplacements / collectionsVidees", () => {
  it("regroupe par couple origine → destination, le plus gros d'abord", () => {
    const r = lire({
      deplacements: [
        { i: 1, collection: "Recettes" },
        { i: 2, collection: "Recettes" },
        { i: 3, collection: "Idées déco" },
      ],
      fusions: [],
      renommages: [],
    });
    const groupes = regrouperDeplacements(r.deplacements);
    expect(groupes.map((g) => [g.deNom, g.versNom, g.deplacements.length])).toEqual([
      ["Divers", "Recettes", 2],
      ["Divers", "Idées déco", 1],
    ]);
  });

  it("repère les collections qui se vident, sans compter les sources de fusion", () => {
    const retenus = [{ deId: "c3" }, { deId: "c3" }, { deId: "c3" }, { deId: "c2" }];
    const noms = { c1: "Recettes", c2: "Cuisine", c3: "Divers" };
    const comptes = { c1: 2, c2: 1, c3: 3 };
    expect(collectionsVidees(retenus, comptes, noms, new Set())).toEqual(["Cuisine", "Divers"]);
    expect(collectionsVidees(retenus, comptes, noms, new Set(["c2"]))).toEqual(["Divers"]);
    expect(collectionsVidees([{ deId: "c3" }], comptes, noms, new Set())).toEqual([]);
  });
});

describe("prompt et lisibilité", () => {
  it("numérote collections et éléments et indique la collection de chacun", () => {
    const p = construirePromptReorganisationCollections(ELEMENTS, COLLECTIONS, "pas plus de 3 collections");
    expect(p).toContain("1. Recettes (2 éléments)");
    expect(p).toContain("2. Cuisine (1 élément)");
    expect(p).toContain("1. [photo] Gratin | dans : 3");
    expect(p).toContain("pas plus de 3 collections");
  });

  it("un élément sans titre ni description n'est pas lisible", () => {
    expect(estLisible({ titre: null, description: "  " })).toBe(false);
    expect(estLisible({ titre: null, description: "Un canapé" })).toBe(true);
  });
});
