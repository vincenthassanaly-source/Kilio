import { describe, expect, it } from "vitest";
import { creerAttributeurDeCles } from "./cles-affichage";

describe("creerAttributeurDeCles", () => {
  it("garde l'id comme clé pour un article réel ordinaire", () => {
    const cle = creerAttributeurDeCles();
    expect(cle({ id: "a1", libelle: "Lait" })).toBe("a1");
  });

  it("donne à la ligne confirmée la clé de sa ligne optimiste, donc pas de remontage", () => {
    const cle = creerAttributeurDeCles();

    const avant = cle({ id: "temp-123", libelle: "Beurre" });
    const apres = cle({ id: "9f2c", libelle: "Beurre" });

    expect(avant).toBe("temp-123");
    expect(apres).toBe("temp-123");
  });

  it("reste stable aux rendus suivants, après la disparition de la ligne optimiste", () => {
    const cle = creerAttributeurDeCles();
    cle({ id: "temp-123", libelle: "Beurre" });
    cle({ id: "9f2c", libelle: "Beurre" });

    expect(cle({ id: "9f2c", libelle: "Beurre" })).toBe("temp-123");
    expect(cle({ id: "9f2c", libelle: "Beurre renommé" })).toBe("temp-123");
  });

  it("est idempotent pour un article optimiste rendu plusieurs fois", () => {
    const cle = creerAttributeurDeCles();
    expect(cle({ id: "temp-1", libelle: "Pain" })).toBe("temp-1");
    expect(cle({ id: "temp-1", libelle: "Pain" })).toBe("temp-1");
    expect(cle({ id: "x", libelle: "Pain" })).toBe("temp-1");
  });

  it("n'associe un libellé qu'à une seule ligne réelle", () => {
    const cle = creerAttributeurDeCles();
    cle({ id: "temp-1", libelle: "Lait" });

    expect(cle({ id: "r1", libelle: "Lait" })).toBe("temp-1");
    expect(cle({ id: "r2", libelle: "Lait" })).toBe("r2");
  });

  it("apparie plusieurs ajouts en vol par libellé, quel que soit l'ordre de confirmation", () => {
    const cle = creerAttributeurDeCles();
    cle({ id: "temp-a", libelle: "Pain" });
    cle({ id: "temp-b", libelle: "Farine" });

    expect(cle({ id: "r-farine", libelle: "Farine" })).toBe("temp-b");
    expect(cle({ id: "r-pain", libelle: "Pain" })).toBe("temp-a");
  });

  it("ne confond pas un article réel déjà présent avec un ajout du même libellé qui échoue", () => {
    const cle = creerAttributeurDeCles();
    expect(cle({ id: "r0", libelle: "Sel" })).toBe("r0");
    // Ajout optimiste du même libellé annulé par le serveur (doublon) : l'article réel garde sa clé.
    cle({ id: "temp-9", libelle: "Sel" });
    expect(cle({ id: "r0", libelle: "Sel" })).toBe("r0");
  });

  it("deux listes ont des mémoires indépendantes", () => {
    const a = creerAttributeurDeCles();
    const b = creerAttributeurDeCles();
    a({ id: "temp-1", libelle: "Lait" });

    expect(b({ id: "r1", libelle: "Lait" })).toBe("r1");
  });
});
