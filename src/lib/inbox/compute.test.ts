import { describe, expect, it } from "vitest";
import { decouperCapture, libelleNbInbox, pastilleCompteur, TITRE_MAX } from "./compute";

describe("decouperCapture", () => {
  it("une ligne : titre seul", () => {
    expect(decouperCapture("  Appeler le garage  ")).toEqual({ titre: "Appeler le garage", reste: null });
  });
  it("plusieurs lignes : la première est le titre, le reste devient les notes", () => {
    expect(decouperCapture("Idée de cadeau\nUn livre de cuisine\r\nOu une plante")).toEqual({
      titre: "Idée de cadeau",
      reste: "Un livre de cuisine\nOu une plante",
    });
  });
  it("première ligne trop longue : coupe sur un mot et garde le débord", () => {
    const mots = Array.from({ length: 60 }, (_, i) => `mot${i}`).join(" ");
    const { titre, reste } = decouperCapture(mots);
    expect(titre.length).toBeLessThanOrEqual(TITRE_MAX);
    expect(titre.endsWith("mot")).toBe(false);
    expect(`${titre} ${reste}`).toBe(mots);
  });
  it("ignore les lignes vides en fin de texte", () => {
    expect(decouperCapture("Titre\n\n\n")).toEqual({ titre: "Titre", reste: null });
  });
});

describe("libellés", () => {
  it("compteur", () => {
    expect(libelleNbInbox(0)).toBe("Inbox vide");
    expect(libelleNbInbox(1)).toBe("1 élément à trier");
    expect(libelleNbInbox(4)).toBe("4 éléments à trier");
  });
  it("pastille plafonnée", () => {
    expect(pastilleCompteur(0)).toBeNull();
    expect(pastilleCompteur(3)).toBe("3");
    expect(pastilleCompteur(12)).toBe("9+");
  });
});
