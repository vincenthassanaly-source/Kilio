import { describe, expect, it } from "vitest";
import { indexApresPas, indexDepart, indexDepuisScroll, videosDuFil } from "./fil";

describe("videosDuFil", () => {
  it("garde les vidéos dans l'ordre et écarte les photos", () => {
    const items = [
      { id: "a", type: "photo" },
      { id: "b", type: "youtube" },
      { id: "c", type: "photo" },
      { id: "d", type: "tiktok" },
    ];
    expect(videosDuFil(items).map((v) => v.id)).toEqual(["b", "d"]);
  });
});

describe("indexDepart", () => {
  const videos = [{ id: "a" }, { id: "b" }];
  it("retrouve l'index de la vidéo ouverte", () => {
    expect(indexDepart(videos, "b")).toBe(1);
  });
  it("retombe sur 0 si la vidéo est introuvable", () => {
    expect(indexDepart(videos, "x")).toBe(0);
  });
});

describe("indexDepuisScroll", () => {
  it("arrondit à l'écran le plus proche", () => {
    expect(indexDepuisScroll(0, 800, 3)).toBe(0);
    expect(indexDepuisScroll(390, 800, 3)).toBe(0);
    expect(indexDepuisScroll(410, 800, 3)).toBe(1);
    expect(indexDepuisScroll(1600, 800, 3)).toBe(2);
  });
  it("borne le résultat au fil et gère les cas dégénérés", () => {
    expect(indexDepuisScroll(99999, 800, 3)).toBe(2);
    expect(indexDepuisScroll(-50, 800, 3)).toBe(0);
    expect(indexDepuisScroll(100, 0, 3)).toBe(0);
    expect(indexDepuisScroll(100, 800, 0)).toBe(0);
  });
});

describe("indexApresPas", () => {
  it("avance et recule sans boucler", () => {
    expect(indexApresPas(1, 1, 3)).toBe(2);
    expect(indexApresPas(2, 1, 3)).toBe(2);
    expect(indexApresPas(0, -1, 3)).toBe(0);
    expect(indexApresPas(2, -1, 3)).toBe(1);
  });
});
