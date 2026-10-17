import { describe, expect, it } from "vitest";
import {
  champsManquants,
  depasseLimites,
  descriptionFinale,
  hashtagsSuggeres,
  messageManquants,
  normaliserHashtag,
  parserHashtags,
  parserPrix,
} from "./kit";

describe("hashtags", () => {
  it("normalise accents, casse et ponctuation", () => {
    expect(normaliserHashtag("#Été-Chic")).toBe("#etechic");
    expect(normaliserHashtag("  ")).toBeNull();
    expect(normaliserHashtag("#")).toBeNull();
  });

  it("parse une saisie libre sans doublon", () => {
    expect(parserHashtags("#Zara, zara  robe;#Robe vintage")).toEqual(["#zara", "#robe", "#vintage"]);
  });

  it("suggère catégorie puis communs, sans ceux déjà présents", () => {
    const reglages = {
      hashtags_communs: ["#vinted", "#bonplan"],
      hashtags_par_categorie: { robes: ["#robe", "#vinted"] },
    };
    expect(hashtagsSuggeres("Robes", ["#bonplan"], reglages)).toEqual(["#robe", "#vinted"]);
    expect(hashtagsSuggeres("", [], reglages)).toEqual(["#vinted", "#bonplan"]);
  });
});

describe("descriptionFinale", () => {
  it("assemble texte, signature et hashtags en ignorant les blocs vides", () => {
    expect(descriptionFinale({ description: " Robe verte ", hashtags: ["#robe", "#vert"] }, { signature: "Envoi rapide" })).toBe(
      "Robe verte\n\nEnvoi rapide\n\n#robe #vert"
    );
    expect(descriptionFinale({ description: "Robe", hashtags: [] }, { signature: "" })).toBe("Robe");
  });
});

describe("champsManquants", () => {
  const complet = { titre: "Robe", description: "Jolie", categorie: "Robes", etat: "Bon état", prix: 10, colis: "Petit" };

  it("ne signale rien quand l'annonce est complète", () => {
    expect(champsManquants(complet, 2)).toEqual([]);
  });

  it("signale photos, prix nul et colis vide sans défaut", () => {
    expect(champsManquants({ ...complet, prix: 0, colis: "" }, 0)).toEqual(["photos", "prix", "colis"]);
  });

  it("accepte le colis par défaut des réglages", () => {
    expect(champsManquants({ ...complet, colis: "" }, 1, { signature: "", colis_defaut: "Moyen" })).toEqual([]);
  });

  it("formule un message lisible", () => {
    expect(messageManquants(["photos", "prix"])).toBe("Il manque : au moins une photo, un prix.");
  });
});

describe("limites et prix", () => {
  it("détecte un titre ou une description trop longs (signature incluse)", () => {
    const limites = depasseLimites({ titre: "x".repeat(101), description: "y".repeat(1990), hashtags: [] }, "z".repeat(20));
    expect(limites).toEqual({ titre: true, description: true });
  });

  it("parse un prix avec virgule", () => {
    expect(parserPrix("12,5")).toBe(12.5);
    expect(parserPrix("")).toBeNull();
    expect(parserPrix("abc")).toBeNull();
    expect(parserPrix("-3")).toBeNull();
  });
});
