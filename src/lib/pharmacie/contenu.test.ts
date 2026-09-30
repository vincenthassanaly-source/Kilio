import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appliquerNiveau, contientNiveau, enTexteBrut, META_NIVEAU, NIVEAUX, parseContenu } from "./contenu";

const COULEURS = ["bleu", "vert", "orange", "rouge", "gris", "violet", "rose", "jaune", "turquoise", "marron", "indigo", "lime"];

describe("couleurs disponibles", () => {
  it("expose les 12 couleurs, les 5 historiques en tête", () => {
    expect([...NIVEAUX]).toEqual(COULEURS);
    expect(Object.keys(META_NIVEAU)).toEqual(COULEURS);
  });

  it("définit chaque jeton de couleur en thème clair et sombre", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const clair = css.slice(css.indexOf(":root {"), css.indexOf(":root.dark"));
    const sombre = css.slice(css.indexOf(":root.dark"));
    for (const { couleur } of Object.values(META_NIVEAU)) {
      const jeton = /var\((--[\w-]+)\)/.exec(couleur)?.[1];
      expect(jeton, couleur).toBeDefined();
      expect(clair, `${jeton} (clair)`).toContain(`${jeton}:`);
      // --ink-3 et les accents historiques sont redéfinis en sombre comme les nouveaux.
      expect(sombre, `${jeton} (sombre)`).toContain(`${jeton}:`);
    }
  });
});

describe("parseContenu", () => {
  it("un contenu sans balise reste un seul bloc, inchangé", () => {
    const contenu = "Adulte non diabétique : 0,70 à 1,10 g/L.\nConversion : g/L × 5,55 = mmol/L.";
    expect(parseContenu(contenu)).toEqual([{ type: "texte", texte: contenu }]);
  });

  it("reconnaît une balise en début de ligne et regroupe le texte autour", () => {
    expect(parseContenu("Intro\n[vert] Normale : 0,70 – 1,10 g/L\n[Rouge]Diabète : ≥ 1,26 g/L\nFin")).toEqual([
      { type: "texte", texte: "Intro" },
      { type: "niveau", niveau: "vert", texte: "Normale : 0,70 – 1,10 g/L" },
      { type: "niveau", niveau: "rouge", texte: "Diabète : ≥ 1,26 g/L" },
      { type: "texte", texte: "Fin" },
    ]);
  });

  it.each(COULEURS)("reconnaît la balise [%s], quelle que soit la casse", (couleur) => {
    expect(parseContenu(`[${couleur}] Texte : 1,5 g`)).toEqual([{ type: "niveau", niveau: couleur, texte: "Texte : 1,5 g" }]);
    expect(parseContenu(`[${couleur.toUpperCase()}]Texte`)).toEqual([{ type: "niveau", niveau: couleur, texte: "Texte" }]);
  });

  it("ignore les balises inconnues, seules ou au milieu d'une ligne", () => {
    for (const contenu of ["[fuchsia] texte", "[vert]", "[violet]   ", "ligne [violet] milieu", "[1] référence"]) {
      expect(parseContenu(contenu)).toEqual([{ type: "texte", texte: contenu }]);
    }
  });
});

describe("enTexteBrut et contientNiveau", () => {
  it("retire les balises et garde le texte", () => {
    expect(enTexteBrut("[orange] Prédiabète : 1,10 à 1,25 g/L\nNote")).toBe("Prédiabète : 1,10 à 1,25 g/L\nNote");
    expect(enTexteBrut("sans balise")).toBe("sans balise");
  });
  it.each(COULEURS)("retire la balise [%s] et la détecte", (couleur) => {
    expect(enTexteBrut(`[${couleur}] Texte\nNote`)).toBe("Texte\nNote");
    expect(contientNiveau(`[${couleur}] Texte`)).toBe(true);
  });
  it("laisse une balise inconnue comme texte ordinaire", () => {
    expect(enTexteBrut("[fuchsia] Texte")).toBe("[fuchsia] Texte");
    expect(contientNiveau("[fuchsia] Texte")).toBe(false);
  });
  it("détecte la présence d'un niveau", () => {
    expect(contientNiveau("a\n[bleu] b")).toBe(true);
    expect(contientNiveau("a\n[bleu]")).toBe(false);
  });
});

describe("appliquerNiveau", () => {
  const texte = "Normale : 0,70\nPrédiabète : 1,10\nDiabète : 1,26";

  it("colore la ligne du curseur et place le curseur en fin de ligne", () => {
    const r = appliquerNiveau(texte, 3, 3, "vert");
    expect(r.texte).toBe("[vert] Normale : 0,70\nPrédiabète : 1,10\nDiabète : 1,26");
    expect(r.debut).toBe("[vert] Normale : 0,70".length);
    expect(r.fin).toBe(r.debut);
  });

  it("colore toutes les lignes touchées par la sélection", () => {
    const r = appliquerNiveau(texte, 5, 20, "orange");
    expect(r.texte).toBe("[orange] Normale : 0,70\n[orange] Prédiabète : 1,10\nDiabète : 1,26");
  });

  it("remplace une couleur existante au lieu de l'empiler", () => {
    const r = appliquerNiveau("[vert] Normale", 0, 0, "rouge");
    expect(r.texte).toBe("[rouge] Normale");
  });

  it("retire la couleur avec null", () => {
    expect(appliquerNiveau("[vert] Normale\n[rouge] Diabète", 0, 30, null).texte).toBe("Normale\nDiabète");
  });

  it("balise une ligne vide seule mais pas les lignes vides d'une sélection", () => {
    expect(appliquerNiveau("", 0, 0, "bleu").texte).toBe("[bleu] ");
    expect(appliquerNiveau("[violet] a", 0, 0, "lime").texte).toBe("[lime] a");
    expect(appliquerNiveau("[turquoise] a", 0, 0, null).texte).toBe("a");
    expect(appliquerNiveau("a\n\nb", 0, 4, "gris").texte).toBe("[gris] a\n\n[gris] b");
  });
});
