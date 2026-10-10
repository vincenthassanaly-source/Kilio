import { describe, expect, it } from "vitest";
import { texteTacheDepuisPartage } from "./tache";

describe("texteTacheDepuisPartage", () => {
  it("laisse titre et notes vides pour un screenshot seul", () => {
    expect(texteTacheDepuisPartage({})).toEqual({ titre: "", notes: "" });
  });

  it("met le texte en titre et le lien en notes", () => {
    expect(texteTacheDepuisPartage({ text: "Super article https://exemple.fr/a", url: "https://exemple.fr/a" })).toEqual({
      titre: "Super article",
      notes: "https://exemple.fr/a",
    });
  });

  it("garde un lien seul en notes sans titre", () => {
    expect(texteTacheDepuisPartage({ url: "https://exemple.fr" })).toEqual({ titre: "", notes: "https://exemple.fr" });
  });

  it("tronque un titre trop long", () => {
    expect(texteTacheDepuisPartage({ text: "a".repeat(500) }).titre).toHaveLength(200);
  });
});
