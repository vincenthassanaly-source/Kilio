import { describe, expect, it } from "vitest";
import { repartirEnColonnes } from "./colonnes";

describe("repartirEnColonnes", () => {
  it("remplit ligne par ligne (1 et 2 en haut, 3 et 4 ensuite)", () => {
    expect(repartirEnColonnes([1, 2, 3, 4, 5])).toEqual([
      [1, 3, 5],
      [2, 4],
    ]);
  });

  it("garde deux colonnes même vides ou avec un seul élément", () => {
    expect(repartirEnColonnes([])).toEqual([[], []]);
    expect(repartirEnColonnes(["a"])).toEqual([["a"], []]);
  });
});
