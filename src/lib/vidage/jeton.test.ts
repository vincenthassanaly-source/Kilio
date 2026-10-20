// @vitest-environment node
import { describe, expect, it } from "vitest";
import { lireJeton, signerJeton } from "./jeton";

const SECRET = "s".repeat(40);
const MAINTENANT = 1_000_000;

describe("jeton signé", () => {
  it("relit la charge d'un jeton valide", () => {
    const jeton = signerJeton({ type: "session", exp: MAINTENANT + 1000 }, SECRET);
    expect(lireJeton(jeton, SECRET, MAINTENANT)).toEqual({ type: "session", exp: MAINTENANT + 1000, defi: undefined });
  });

  it("garde le défi WebAuthn", () => {
    const jeton = signerJeton({ type: "inscription", exp: MAINTENANT + 1, defi: "abc" }, SECRET);
    expect(lireJeton(jeton, SECRET, MAINTENANT)?.defi).toBe("abc");
  });

  it("refuse un jeton expiré", () => {
    const jeton = signerJeton({ type: "session", exp: MAINTENANT }, SECRET);
    expect(lireJeton(jeton, SECRET, MAINTENANT)).toBeNull();
  });

  it("refuse un autre secret, une charge modifiée et un jeton mal formé", () => {
    const jeton = signerJeton({ type: "session", exp: MAINTENANT + 1000 }, SECRET);
    expect(lireJeton(jeton, "x".repeat(40), MAINTENANT)).toBeNull();

    const [, signature] = jeton.split(".");
    const falsifie = Buffer.from(JSON.stringify({ type: "session", exp: MAINTENANT + 9_999_999 })).toString("base64url");
    expect(lireJeton(`${falsifie}.${signature}`, SECRET, MAINTENANT)).toBeNull();

    for (const mauvais of [undefined, "", "abc", "a.b.c", ".sig", "corps."]) expect(lireJeton(mauvais, SECRET, MAINTENANT)).toBeNull();
  });
});
