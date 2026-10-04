import { describe, expect, it } from "vitest";
import { echapperLike, guillemetsPostgrest, motifContient } from "./like";

describe("echapperLike", () => {
  it("neutralise les jokers et l'antislash", () => {
    expect(echapperLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("laisse intactes les virgules (sans effet dans un ilike simple)", () => {
    expect(echapperLike("a,b")).toBe("a,b");
  });
});

describe("motifContient", () => {
  it("entoure la saisie échappée de %", () => {
    expect(motifContient("100%")).toBe("%100\\%%");
  });
});

describe("guillemetsPostgrest", () => {
  it("garde virgules et parenthèses à l'intérieur de la valeur", () => {
    expect(guillemetsPostgrest("a,b)")).toBe('"a,b)"');
  });

  it("échappe guillemets et antislash pour ne pas fermer la valeur", () => {
    expect(guillemetsPostgrest('a"b\\')).toBe('"a\\"b\\\\"');
  });

  it("compose avec echapperLike : l'échappement LIKE survit au déquotage", () => {
    expect(guillemetsPostgrest(motifContient("5%"))).toBe('"%5\\\\%%"');
  });
});
