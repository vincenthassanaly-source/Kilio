import { describe, expect, it } from "vitest";
import { estUrlImageAnalysable } from "./image";
import {
  EXEMPLES_PAR_COLLECTION,
  EXEMPLE_MAX,
  construireExemples,
  construirePromptRangement,
  lireReponseRangement,
} from "./rangement";

describe("lireReponseRangement", () => {
  it("convertit le numéro (1 = première collection) en indice", () => {
    expect(lireReponseRangement({ numero: 1 }, 3)).toBe(0);
    expect(lireReponseRangement({ numero: 3 }, 3)).toBe(2);
  });

  it("renvoie null pour « aucune » (0) et pour un numéro hors liste", () => {
    expect(lireReponseRangement({ numero: 0 }, 3)).toBeNull();
    expect(lireReponseRangement({ numero: 4 }, 3)).toBeNull();
    expect(lireReponseRangement({ numero: -1 }, 3)).toBeNull();
  });

  it("renvoie null pour une réponse illisible", () => {
    expect(lireReponseRangement({ numero: "2" }, 3)).toBeNull();
    expect(lireReponseRangement({ numero: 1.5 }, 3)).toBeNull();
    expect(lireReponseRangement({}, 3)).toBeNull();
    expect(lireReponseRangement(null, 3)).toBeNull();
    expect(lireReponseRangement("2", 3)).toBeNull();
  });
});

describe("construireExemples", () => {
  it("joint titre et description, ignore les éléments vides", () => {
    expect(
      construireExemples([
        { titre: "Gratin", description: "Une recette" },
        { titre: null, description: null },
        { titre: "Canapé", description: null },
        { titre: null, description: "Seule description" },
      ])
    ).toEqual(["Gratin — Une recette", "Canapé", "Seule description"]);
  });

  it("plafonne le nombre d'exemples et leur longueur", () => {
    const beaucoup = Array.from({ length: 20 }, (_, i) => ({ titre: `T${i}`, description: "x".repeat(500) }));
    const exemples = construireExemples(beaucoup);
    expect(exemples).toHaveLength(EXEMPLES_PAR_COLLECTION);
    expect(exemples.every((e) => e.length <= EXEMPLE_MAX)).toBe(true);
  });

  it("fonctionne sans la colonne description", () => {
    expect(construireExemples([{ titre: "Tuto" }])).toEqual(["Tuto"]);
  });
});

describe("construirePromptRangement", () => {
  const collections = [
    { id: "a", nom: "Recettes", exemples: ["Gratin — recette"] },
    { id: "b", nom: "Déco", exemples: [] },
  ];

  it("numérote les collections et montre leur contenu", () => {
    const p = construirePromptRangement({ type: "tiktok", titre: "Gratin #miam" }, true, collections);
    expect(p).toContain("1. Recettes — contient par exemple : « Gratin — recette »");
    expect(p).toContain("2. Déco — vide pour l'instant");
    expect(p).toContain("Gratin #miam");
    expect(p).toContain("vidéo tiktok");
  });

  it("autorise de répondre 0 et signale l'absence d'image", () => {
    const p = construirePromptRangement({ type: "photo", titre: null }, false, collections);
    expect(p).toContain("Réponds 0");
    expect(p).toContain("Aucune image");
  });
});

describe("estUrlImageAnalysable", () => {
  const hote = "projet.supabase.co";

  it("accepte le stockage de l'app et les CDN de miniatures connus, en HTTPS", () => {
    expect(estUrlImageAnalysable("https://projet.supabase.co/storage/v1/object/public/collection-images/a.jpg", hote)).toBe(true);
    expect(estUrlImageAnalysable("https://i.ytimg.com/vi/x/hqdefault.jpg", hote)).toBe(true);
    expect(estUrlImageAnalysable("https://p16-sign.tiktokcdn.com/obj/x.jpeg", hote)).toBe(true);
  });

  it("refuse tout autre hôte, le HTTP et les adresses invalides", () => {
    expect(estUrlImageAnalysable("https://evil.test/collection-images/a.jpg", hote)).toBe(false);
    expect(estUrlImageAnalysable("https://ytimg.com.evil.test/x.jpg", hote)).toBe(false);
    expect(estUrlImageAnalysable("http://projet.supabase.co/a.jpg", hote)).toBe(false);
    expect(estUrlImageAnalysable("http://127.0.0.1:8080/x.jpg", hote)).toBe(false);
    expect(estUrlImageAnalysable("pas une url", hote)).toBe(false);
  });

  it("refuse le stockage de l'app quand son hôte est inconnu", () => {
    expect(estUrlImageAnalysable("https://projet.supabase.co/a.jpg", null)).toBe(false);
  });
});
