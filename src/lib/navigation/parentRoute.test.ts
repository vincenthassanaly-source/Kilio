import { describe, expect, it } from "vitest";
import { parentRoute } from "./parentRoute";

const BARRE = ["/", "/nutrition", "/taches", "/habitudes"];

describe("parentRoute", () => {
  it("n'a pas de parent pour l'accueil", () => {
    expect(parentRoute("/", BARRE)).toBeNull();
  });

  it("ramène /plus à l'accueil", () => {
    expect(parentRoute("/plus", BARRE)).toBe("/");
  });

  it("ramène un module épinglé à l'accueil", () => {
    expect(parentRoute("/taches", BARRE)).toBe("/");
  });

  it("ramène un module non épinglé à la grille Plus", () => {
    expect(parentRoute("/budget", BARRE)).toBe("/plus");
    expect(parentRoute("/courses", BARRE)).toBe("/plus");
  });

  it("suit l'épinglage personnalisé", () => {
    expect(parentRoute("/budget", ["/", "/budget", "/taches", "/habitudes"])).toBe("/");
  });

  it("remonte une sous-page d'un segment", () => {
    expect(parentRoute("/nutrition/recettes/abc", BARRE)).toBe("/nutrition/recettes");
    expect(parentRoute("/nutrition/recettes", BARRE)).toBe("/nutrition");
    expect(parentRoute("/budget/comptes", BARRE)).toBe("/budget");
    expect(parentRoute("/pharmacie/m1/c1", BARRE)).toBe("/pharmacie/m1");
  });

  it("ignore le slash final et retombe sur l'accueil pour une route inconnue", () => {
    expect(parentRoute("/taches/", BARRE)).toBe("/");
    expect(parentRoute("/inconnu/x", BARRE)).toBe("/");
  });
});
