import { afterEach, describe, expect, it } from "vitest";
import { consommerParamEdition, HREF_PLUS_EDITION } from "./paramEdition";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("consommerParamEdition", () => {
  it("détecte ?edition=1 et le retire de l'URL", () => {
    window.history.replaceState(null, "", HREF_PLUS_EDITION);
    expect(consommerParamEdition()).toBe(true);
    expect(window.location.pathname).toBe("/plus");
    expect(window.location.search).toBe("");
  });

  it("garde les autres paramètres", () => {
    window.history.replaceState(null, "", "/plus?edition=1&x=2#h");
    expect(consommerParamEdition()).toBe(true);
    expect(window.location.search).toBe("?x=2");
    expect(window.location.hash).toBe("#h");
  });

  it("ne fait rien sans le paramètre", () => {
    window.history.replaceState(null, "", "/plus?edition=0");
    expect(consommerParamEdition()).toBe(false);
    expect(window.location.search).toBe("?edition=0");
  });
});
