import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "./compute";
import {
  interpreterRepas,
  libelleJourRepas,
  lignesContexteRepas,
  repasComplet,
  type ContexteRepas,
} from "./saisie-naturelle";

const zero = { kcal: 0, proteines: 0, glucides: 0, lipides: 0 };
const catalogue: CatalogueItem[] = [
  { type: "aliment", id: "a-oeuf", nom: "Œuf", categorie: null, unite: "piece", poidsUniteG: 60, par100: { ...zero, kcal: 140 } },
  { type: "aliment", id: "a-riz", nom: "Riz basmati", categorie: null, unite: "g", poidsUniteG: null, par100: { ...zero, kcal: 350 } },
  { type: "aliment", id: "a-lait", nom: "Lait", categorie: null, unite: "ml", poidsUniteG: null, par100: { ...zero, kcal: 46 } },
  { type: "aliment", id: "a-yaourt", nom: "Yaourt", categorie: null, unite: "piece", poidsUniteG: null, par100: { ...zero, kcal: 60 } },
  { type: "recette", id: "r-lasagnes", nom: "Lasagnes", parPortion: { ...zero, kcal: 520 } },
];
// Jeudi 1er octobre 2026, 8 h 30 à Paris.
const ctx: ContexteRepas = { catalogue, aujourdhui: "2026-10-01", heure: 8.5 };

const brut = (surcharge: Record<string, unknown> = {}) => ({
  aliment: "œufs",
  correspondance: "Œuf",
  quantite: 2,
  unite: "piece",
  moment: "petit_dej",
  date: "2026-10-01",
  ...surcharge,
});

function un(surcharge: Record<string, unknown> = {}) {
  return interpreterRepas([brut(surcharge)], ctx)[0];
}

describe("interpreterRepas", () => {
  it("rapproche un aliment du catalogue et convertit les pièces en grammes", () => {
    expect(un()).toMatchObject({
      nom: "Œuf",
      cible: { type: "aliment", id: "a-oeuf" },
      quantite: 120,
      quantiteLibelle: "2 pièces",
      moment: "petit_dej",
      date: "2026-10-01",
      kcal: 168,
      avertissements: [],
    });
  });

  it("garde grammes et millilitres tels quels, avec l'unité de l'aliment", () => {
    expect(un({ correspondance: "Riz basmati", aliment: "riz", quantite: 150, unite: "g" })).toMatchObject({
      quantite: 150,
      quantiteLibelle: "150 g",
      kcal: 525,
    });
    expect(un({ correspondance: "Lait", aliment: "lait", quantite: 200, unite: "ml" })).toMatchObject({
      quantiteLibelle: "200 ml",
      kcal: 92,
    });
  });

  it("accepte la correspondance sans accents ni casse", () => {
    expect(un({ correspondance: "oeuf" }).cible).toEqual({ type: "aliment", id: "a-oeuf" });
  });

  it("retombe sur le mot cité quand la correspondance est vide mais exacte", () => {
    expect(un({ correspondance: "", aliment: "Yaourt", quantite: 1, unite: "piece" }).cible).toEqual({
      type: "aliment",
      id: "a-yaourt",
    });
  });

  it("ne retient aucune correspondance approximative : à préciser, sans valeurs inventées", () => {
    const r = un({ correspondance: "Œufs brouillés", aliment: "œufs brouillés" });
    expect(r).toMatchObject({ nom: "œufs brouillés", cible: null, quantite: null, kcal: null });
    expect(r.avertissements.join(" ")).toMatch(/Aucun aliment du catalogue/);
    expect(repasComplet(r)).toBe(false);
  });

  it("une recette se compte en portions", () => {
    expect(un({ correspondance: "Lasagnes", aliment: "lasagnes", quantite: 1.5, unite: "portion" })).toMatchObject({
      cible: { type: "recette", id: "r-lasagnes" },
      quantite: 1.5,
      quantiteLibelle: "1,5 portions",
      kcal: 780,
    });
    const r = un({ correspondance: "Lasagnes", aliment: "lasagnes", quantite: 300, unite: "g" });
    expect(r.quantite).toBeNull();
    expect(r.avertissements.join(" ")).toMatch(/portions/);
  });

  it("refuse les pièces d'un aliment sans poids par pièce et le dit", () => {
    const r = un({ correspondance: "Yaourt", aliment: "yaourt", quantite: 2, unite: "piece" });
    expect(r).toMatchObject({ cible: { type: "aliment", id: "a-yaourt" }, quantite: null, kcal: null });
    expect(r.avertissements.join(" ")).toMatch(/pas de poids par pièce/);
  });

  it("quantité absente, nulle ou hors bornes : à préciser", () => {
    for (const quantite of [0, -1, 100000, null, "beaucoup"]) {
      const r = un({ quantite, unite: "" });
      expect(r.quantite).toBeNull();
      expect(repasComplet(r)).toBe(false);
      expect(r.avertissements.join(" ")).toMatch(/Quantité à préciser/);
    }
  });

  it("une portion d'aliment n'a pas de sens", () => {
    expect(un({ unite: "portion" }).quantite).toBeNull();
  });

  it("moment inconnu ou vide : celui de l'heure ; date invalide : aujourd'hui", () => {
    expect(un({ moment: "" }).moment).toBe("petit_dej");
    expect(interpreterRepas([brut({ moment: "brunch" })], { ...ctx, heure: 12.5 })[0].moment).toBe("dejeuner");
    expect(un({ date: "2026-02-31" }).date).toBe("2026-10-01");
    expect(un({ date: "2026-09-30" }).date).toBe("2026-09-30");
  });

  it("écarte un repas sans aucun nom", () => {
    expect(interpreterRepas([brut({ aliment: " ", correspondance: "" })], ctx)).toEqual([]);
  });
});

describe("libelleJourRepas", () => {
  it("dit aujourd'hui, hier, sinon la date", () => {
    expect(libelleJourRepas("2026-10-01", "2026-10-01")).toBe("Aujourd'hui");
    expect(libelleJourRepas("2026-09-30", "2026-10-01")).toBe("Hier");
    expect(libelleJourRepas("2026-09-28", "2026-10-01")).toMatch(/28/);
  });
});

describe("lignesContexteRepas", () => {
  it("sépare aliments et recettes", () => {
    const [aliments, recettes] = lignesContexteRepas(catalogue);
    expect(aliments).toContain('"Riz basmati"');
    expect(aliments).not.toContain("Lasagnes");
    expect(recettes).toContain('["Lasagnes"]');
  });
});
