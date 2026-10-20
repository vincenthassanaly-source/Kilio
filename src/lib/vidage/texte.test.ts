import { describe, expect, it } from "vitest";
import { ajouterBloc, depasseLimite } from "./texte";

describe("ajouterBloc", () => {
  it("commence le texte du jour par l'heure du premier bloc", () => {
    expect(ajouterBloc(null, "  Ma journée  ", "14:32")).toBe("14:32\nMa journée");
    expect(ajouterBloc("   ", "Bonjour", "08:05")).toBe("08:05\nBonjour");
  });

  it("ajoute chaque nouveau bloc à la suite, après une ligne vide", () => {
    const premier = ajouterBloc(null, "Matin", "09:00");
    expect(ajouterBloc(premier, "Soir", "21:10")).toBe("09:00\nMatin\n\n21:10\nSoir");
  });

  it("garde un texte plus ancien, sans heure, tel quel avant le nouveau bloc", () => {
    expect(ajouterBloc("Texte déjà là\n", "Suite", "10:00")).toBe("Texte déjà là\n\n10:00\nSuite");
  });
});

describe("depasseLimite", () => {
  it("refuse un ajout qui ferait dépasser la limite du texte", () => {
    expect(depasseLimite(null, "a", "10:00")).toBe(false);
    expect(depasseLimite("a".repeat(49_990), "b".repeat(20), "10:00")).toBe(true);
  });
});
