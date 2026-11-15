import { afterEach, describe, expect, it, vi } from "vitest";
import { CLE_VUE_AGENDA, lireVueMemorisee, memoriserVue } from "./vueMemorisee";

const VUES = ["jour", "semaine", "mois", "liste"] as const;

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("vue mémorisée de l'agenda", () => {
  it("n'a rien à relire tant que rien n'a été mémorisé", () => {
    expect(lireVueMemorisee(VUES)).toBeNull();
  });

  it("relit la dernière vue mémorisée", () => {
    memoriserVue("liste");
    expect(window.localStorage.getItem(CLE_VUE_AGENDA)).toBe("liste");
    expect(lireVueMemorisee(VUES)).toBe("liste");
  });

  it("ignore une valeur qui n'est plus une vue connue", () => {
    window.localStorage.setItem(CLE_VUE_AGENDA, "annee");
    expect(lireVueMemorisee(VUES)).toBeNull();
  });

  it("reste silencieux quand le stockage est indisponible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });
    expect(lireVueMemorisee(VUES)).toBeNull();
    expect(() => memoriserVue("mois")).not.toThrow();
  });
});
