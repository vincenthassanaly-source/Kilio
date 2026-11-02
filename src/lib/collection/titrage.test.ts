import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX,
  TITRE_MAX,
  construirePromptTitrage,
  estADecrire,
  lireReponseTitrage,
  libelleNature,
  lotADecrire,
  titrageDisponible,
} from "./titrage";

describe("lireReponseTitrage", () => {
  it("nettoie le titre : espaces, guillemets et point final", () => {
    const r = lireReponseTitrage({ titre: "  « Gratin   dauphinois. »  ", description: "Une recette." }, null);
    expect(r).toEqual({ titre: "Gratin dauphinois", description: "Une recette." });
  });

  it("retombe sur le titre actuel si Gemini n'en donne pas", () => {
    expect(lireReponseTitrage({ titre: "", description: "x" }, "Ma légende").titre).toBe("Ma légende");
  });

  it("retombe sur « Sans titre » sans titre ni légende", () => {
    expect(lireReponseTitrage({}, null).titre).toBe("Sans titre");
  });

  it("ignore une réponse qui n'est pas un objet", () => {
    expect(lireReponseTitrage("n'importe quoi", null)).toEqual({ titre: "Sans titre", description: "" });
    expect(lireReponseTitrage(null, null).description).toBe("");
  });

  it("plafonne les longueurs", () => {
    const r = lireReponseTitrage({ titre: "a".repeat(500), description: "b".repeat(2000) }, null);
    expect(r.titre.length).toBeLessThanOrEqual(TITRE_MAX);
    expect(r.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});

describe("estADecrire / lotADecrire", () => {
  const item = (id: string, description: string | null, created_at: string) => ({ id, description, created_at });

  it("considère vide, null et blanc comme « à décrire »", () => {
    expect(estADecrire({ description: null })).toBe(true);
    expect(estADecrire({ description: "   " })).toBe(true);
    expect(estADecrire({ description: "Un chat" })).toBe(false);
  });

  it("prend les plus récents sans description, dans la limite du lot", () => {
    const elements = [
      item("a", null, "2026-11-01T10:00:00Z"),
      item("b", "déjà décrit", "2026-11-02T10:00:00Z"),
      item("c", null, "2026-11-02T09:00:00Z"),
      item("d", null, "2026-10-30T09:00:00Z"),
    ];
    expect(lotADecrire(elements, 2).map((e) => e.id)).toEqual(["c", "a"]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const elements = [item("a", null, "2026-11-01T10:00:00Z"), item("b", null, "2026-11-02T10:00:00Z")];
    lotADecrire(elements);
    expect(elements.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("titrageDisponible", () => {
  it("est vrai quand la colonne description est renvoyée par la base", () => {
    expect(titrageDisponible([{ id: "a", description: null }])).toBe(true);
  });

  it("est faux tant que la migration n'est pas appliquée (clé absente)", () => {
    expect(titrageDisponible([{ id: "a" }])).toBe(false);
  });

  it("est faux sans élément", () => {
    expect(titrageDisponible([])).toBe(false);
  });
});

describe("construirePromptTitrage", () => {
  it("mentionne la légende et la nature de l'image", () => {
    const p = construirePromptTitrage({ type: "tiktok", titre: "Gratin 😋 #recette" }, true);
    expect(p).toContain("Gratin 😋 #recette");
    expect(p).toContain("TikTok");
  });

  it("indique l'absence d'image", () => {
    expect(construirePromptTitrage({ type: "photo", titre: null }, false)).toContain("Aucune image");
  });
});

describe("libelleNature", () => {
  it("nomme chaque type", () => {
    expect(libelleNature("tiktok")).toBe("Vidéo TikTok");
    expect(libelleNature("youtube")).toBe("Vidéo YouTube");
    expect(libelleNature("photo")).toBe("Photo");
  });
});
