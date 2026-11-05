import { describe, expect, it } from "vitest";
import {
  addNutrition,
  cleCatalogue,
  extraireRecents,
  hasNutritionOverride,
  momentParDefaut,
  nutritionAliment,
  nutritionFromOverride,
  nutritionRecette,
  nutritionSaisie,
  pasSaisie,
  quantiteStockee,
  rechercherCatalogue,
  saisieParDefaut,
  scaleNutrition,
  zeroNutrition,
  type CatalogueAliment,
  type CatalogueItem,
  type CatalogueRecette,
} from "./compute";

describe("zeroNutrition / addNutrition / scaleNutrition", () => {
  it("zeroNutrition renvoie toutes les valeurs à 0", () => {
    expect(zeroNutrition()).toEqual({ kcal: 0, proteines: 0, glucides: 0, lipides: 0 });
  });

  it("addNutrition additionne chaque macro indépendamment", () => {
    const a = { kcal: 100, proteines: 10, glucides: 20, lipides: 5 };
    const b = { kcal: 50, proteines: 5, glucides: 5, lipides: 2 };
    expect(addNutrition(a, b)).toEqual({ kcal: 150, proteines: 15, glucides: 25, lipides: 7 });
  });

  it("scaleNutrition multiplie chaque macro par le facteur", () => {
    const n = { kcal: 100, proteines: 10, glucides: 20, lipides: 5 };
    expect(scaleNutrition(n, 0.5)).toEqual({ kcal: 50, proteines: 5, glucides: 10, lipides: 2.5 });
  });
});

describe("nutritionAliment", () => {
  it("applique le ratio quantité/100 aux valeurs pour 100g", () => {
    const aliment = { kcal_100g: 200, proteines_100g: 10, glucides_100g: 30, lipides_100g: 5 };
    expect(nutritionAliment(aliment, 150)).toEqual({
      kcal: 300,
      proteines: 15,
      glucides: 45,
      lipides: 7.5,
    });
  });

  it("renvoie zéro pour une quantité nulle", () => {
    const aliment = { kcal_100g: 200, proteines_100g: 10, glucides_100g: 30, lipides_100g: 5 };
    expect(nutritionAliment(aliment, 0)).toEqual({ kcal: 0, proteines: 0, glucides: 0, lipides: 0 });
  });
});

describe("nutritionRecette", () => {
  it("calcule les macros d'une portion consommée depuis les ingrédients", () => {
    const ingredients = [
      { aliment: { kcal_100g: 200, proteines_100g: 10, glucides_100g: 30, lipides_100g: 5 }, quantite: 200 },
      { aliment: { kcal_100g: 100, proteines_100g: 20, glucides_100g: 0, lipides_100g: 2 }, quantite: 100 },
    ];
    // Total : 400+100=500 kcal, 20+20=40 protéines, 60+0=60 glucides, 10+2=12 lipides
    // Recette en 4 portions, on en consomme 1 → /4
    const resultat = nutritionRecette(ingredients, 4, 1);
    expect(resultat).toEqual({ kcal: 125, proteines: 10, glucides: 15, lipides: 3 });
  });

  it("gère une consommation fractionnaire (demi-portion)", () => {
    const ingredients = [
      { aliment: { kcal_100g: 400, proteines_100g: 0, glucides_100g: 0, lipides_100g: 0 }, quantite: 100 },
    ];
    expect(nutritionRecette(ingredients, 2, 0.5).kcal).toBe(100);
  });
});

describe("hasNutritionOverride / nutritionFromOverride", () => {
  it("détecte un override présent (kcal_portion non nul)", () => {
    expect(
      hasNutritionOverride({ kcal_portion: 300, proteines_portion: null, glucides_portion: null, lipides_portion: null })
    ).toBe(true);
  });

  it("détecte l'absence d'override", () => {
    expect(
      hasNutritionOverride({ kcal_portion: null, proteines_portion: null, glucides_portion: null, lipides_portion: null })
    ).toBe(false);
  });

  it("multiplie l'override par les portions consommées, avec null traités comme 0", () => {
    const override = { kcal_portion: 300, proteines_portion: 20, glucides_portion: null, lipides_portion: 10 };
    expect(nutritionFromOverride(override, 2)).toEqual({ kcal: 600, proteines: 40, glucides: 0, lipides: 20 });
  });
});

describe("momentParDefaut", () => {
  it.each([
    [4, "petit_dej"],
    [10, "petit_dej"],
    [10.4, "petit_dej"],
    [11, "dejeuner"],
    [13, "dejeuner"],
    [14.4, "dejeuner"],
    [16, "collation"],
    [18, "diner"],
    [21.9, "diner"],
    [22, "collation"],
    [2, "collation"],
  ] as const)("heure %s -> %s", (heure, attendu) => {
    expect(momentParDefaut(heure)).toBe(attendu);
  });
});

describe("cleCatalogue", () => {
  it("distingue un aliment et une recette portant le même id", () => {
    expect(cleCatalogue({ type: "aliment", id: "x" })).not.toBe(cleCatalogue({ type: "recette", id: "x" }));
  });
});

describe("extraireRecents", () => {
  it("dédoublonne en gardant la première occurrence (la plus récente)", () => {
    const entrees = [
      { aliment_id: "a1", recette_id: null, quantite: 150, moment: "dejeuner" as const },
      { aliment_id: "a1", recette_id: null, quantite: 999, moment: "diner" as const },
      { aliment_id: null, recette_id: "r1", quantite: 1, moment: "diner" as const },
    ];
    const recents = extraireRecents(entrees);
    expect(recents).toEqual([
      { type: "aliment", id: "a1", quantite: 150, moment: "dejeuner" },
      { type: "recette", id: "r1", quantite: 1, moment: "diner" },
    ]);
  });

  it("ignore les entrées sans aliment_id ni recette_id", () => {
    const entrees = [{ aliment_id: null, recette_id: null, quantite: 10, moment: "collation" as const }];
    expect(extraireRecents(entrees)).toEqual([]);
  });

  it("respecte la limite", () => {
    const entrees = Array.from({ length: 10 }, (_, i) => ({
      aliment_id: `a${i}`,
      recette_id: null,
      quantite: 1,
      moment: "collation" as const,
    }));
    expect(extraireRecents(entrees, 3)).toHaveLength(3);
  });
});

describe("rechercherCatalogue", () => {
  const oeuf: CatalogueAliment = {
    type: "aliment",
    id: "oeuf",
    nom: "Œuf dur",
    categorie: "Protéines",
    unite: "piece",
    poidsUniteG: 50,
    par100: { kcal: 155, proteines: 13, glucides: 1, lipides: 11 },
  };
  const omelette: CatalogueRecette = {
    type: "recette",
    id: "omelette",
    nom: "Omelette au fromage",
    parPortion: { kcal: 300, proteines: 20, glucides: 2, lipides: 22 },
  };
  const items: CatalogueItem[] = [oeuf, omelette];

  it("retrouve un aliment sans accent malgré l'accent dans le nom stocké", () => {
    expect(rechercherCatalogue(items, "dur").map((i) => i.id)).toEqual(["oeuf"]);
  });

  // `normalizeSearch()` fait un NFD (dépouille les accents composés : é -> e),
  // mais "œ" est une ligature à part, non décomposée par NFD : chercher
  // "oeuf" (sans la ligature, la saisie la plus naturelle sur mobile) ne
  // retrouve donc pas "Œuf". Documenté ici tel quel (pas un bug qu'on nous
  // a demandé de corriger), à corriger via un remplacement œ/æ -> oe/ae
  // explicite dans `normalizeSearch` si ça gêne en usage réel.
  it("ne retrouve pas 'œuf' en tapant 'oeuf' (limite connue de la normalisation)", () => {
    expect(rechercherCatalogue(items, "oeuf").map((i) => i.id)).toEqual([]);
  });

  it("cherche aussi dans la catégorie de l'aliment", () => {
    expect(rechercherCatalogue(items, "proteines").map((i) => i.id)).toEqual(["oeuf"]);
  });

  it("exige que tous les mots saisis soient présents", () => {
    expect(rechercherCatalogue(items, "omelette fromage").map((i) => i.id)).toEqual(["omelette"]);
    expect(rechercherCatalogue(items, "omelette jambon")).toEqual([]);
  });

  it("renvoie un tableau vide pour une requête vide", () => {
    expect(rechercherCatalogue(items, "   ")).toEqual([]);
  });
});

describe("saisieParDefaut", () => {
  const oeuf: CatalogueAliment = {
    type: "aliment",
    id: "oeuf",
    nom: "Œuf",
    categorie: null,
    unite: "piece",
    poidsUniteG: 50,
    par100: { kcal: 155, proteines: 13, glucides: 1, lipides: 11 },
  };
  const riz: CatalogueAliment = {
    type: "aliment",
    id: "riz",
    nom: "Riz",
    categorie: null,
    unite: "g",
    poidsUniteG: null,
    par100: { kcal: 130, proteines: 3, glucides: 28, lipides: 0.3 },
  };
  const recette: CatalogueRecette = {
    type: "recette",
    id: "r1",
    nom: "Recette",
    parPortion: { kcal: 300, proteines: 20, glucides: 2, lipides: 22 },
  };

  it("propose 1 portion pour une recette sans historique", () => {
    expect(saisieParDefaut(recette)).toEqual({ mode: "grammes", valeur: 1 });
  });

  it("reprend la dernière quantité de recette (en portions)", () => {
    expect(saisieParDefaut(recette, { type: "recette", id: "r1", quantite: 2, moment: "dejeuner" })).toEqual({
      mode: "grammes",
      valeur: 2,
    });
  });

  it("propose 1 pièce pour un aliment 'pièce' sans historique", () => {
    expect(saisieParDefaut(oeuf)).toEqual({ mode: "piece", valeur: 1 });
  });

  it("convertit la dernière quantité en grammes vers un nombre de pièces", () => {
    // 100g avec un poids unitaire de 50g -> 2 pièces
    expect(saisieParDefaut(oeuf, { type: "aliment", id: "oeuf", quantite: 100, moment: "dejeuner" })).toEqual({
      mode: "piece",
      valeur: 2,
    });
  });

  it("plafonne à un minimum de 0.5 pièce", () => {
    expect(saisieParDefaut(oeuf, { type: "aliment", id: "oeuf", quantite: 1, moment: "dejeuner" }).valeur).toBe(0.5);
  });

  it("propose 100g pour un aliment en grammes sans historique", () => {
    expect(saisieParDefaut(riz)).toEqual({ mode: "grammes", valeur: 100 });
  });
});

describe("quantiteStockee", () => {
  const oeuf: CatalogueAliment = {
    type: "aliment",
    id: "oeuf",
    nom: "Œuf",
    categorie: null,
    unite: "piece",
    poidsUniteG: 50,
    par100: { kcal: 155, proteines: 13, glucides: 1, lipides: 11 },
  };

  it("convertit un nombre de pièces en grammes via le poids unitaire", () => {
    expect(quantiteStockee(oeuf, "piece", 2)).toBe(100);
  });

  it("renvoie la valeur telle quelle en mode grammes", () => {
    expect(quantiteStockee(oeuf, "grammes", 100)).toBe(100);
  });
});

describe("nutritionSaisie", () => {
  it("met à l'échelle une recette par le nombre de portions saisies", () => {
    const recette: CatalogueRecette = {
      type: "recette",
      id: "r1",
      nom: "Recette",
      parPortion: { kcal: 300, proteines: 20, glucides: 2, lipides: 22 },
    };
    expect(nutritionSaisie(recette, "grammes", 2)).toEqual({ kcal: 600, proteines: 40, glucides: 4, lipides: 44 });
  });
});

describe("pasSaisie", () => {
  it("vaut 0.5 pour une recette ou un aliment en pièces", () => {
    const recette: CatalogueRecette = { type: "recette", id: "r1", nom: "R", parPortion: zeroNutrition() };
    const oeuf: CatalogueAliment = {
      type: "aliment",
      id: "oeuf",
      nom: "Œuf",
      categorie: null,
      unite: "piece",
      poidsUniteG: 50,
      par100: zeroNutrition(),
    };
    expect(pasSaisie(recette, "grammes")).toBe(0.5);
    expect(pasSaisie(oeuf, "piece")).toBe(0.5);
  });

  it("vaut 10 pour un aliment en grammes", () => {
    const riz: CatalogueAliment = {
      type: "aliment",
      id: "riz",
      nom: "Riz",
      categorie: null,
      unite: "g",
      poidsUniteG: null,
      par100: zeroNutrition(),
    };
    expect(pasSaisie(riz, "grammes")).toBe(10);
  });
});
