import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { basculerTheme, THEME_COLOR_CLAIR, THEME_COLOR_SOMBRE, themeInitScript } from "./theme";

function metaThemeColor() {
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", "#000000");
  document.head.appendChild(meta);
  return meta;
}

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  document.cookie = "kilio-theme=; path=/; max-age=0";
  localStorage.clear();
});

afterEach(() => {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
});

describe("basculerTheme", () => {
  it("passe en sombre : classe, localStorage, cookie et meta theme-color", () => {
    const meta = metaThemeColor();
    basculerTheme();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("kilio-theme")).toBe("dark");
    expect(document.cookie).toContain("kilio-theme=dark");
    expect(meta.getAttribute("content")).toBe(THEME_COLOR_SOMBRE);
  });

  it("revient au clair au second appel", () => {
    const meta = metaThemeColor();
    basculerTheme();
    basculerTheme();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("kilio-theme")).toBe("light");
    expect(document.cookie).toContain("kilio-theme=light");
    expect(meta.getAttribute("content")).toBe(THEME_COLOR_CLAIR);
  });

  it("applique quand même le thème si localStorage lève", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      basculerTheme();
    } finally {
      Storage.prototype.setItem = original;
    }
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("kilio-theme=dark");
  });
});

describe("themeInitScript", () => {
  const executer = () => new Function(themeInitScript)();

  it("applique le sombre depuis le cookie, prioritaire sur localStorage", () => {
    document.cookie = "kilio-theme=dark; path=/";
    localStorage.setItem("kilio-theme", "light");
    executer();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("utilise localStorage sans cookie", () => {
    localStorage.setItem("kilio-theme", "dark");
    executer();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("retombe sur la préférence système sans choix enregistré", () => {
    const original = window.matchMedia;
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    try {
      executer();
    } finally {
      window.matchMedia = original;
    }
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
