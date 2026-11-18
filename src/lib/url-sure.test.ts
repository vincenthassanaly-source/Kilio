import { describe, expect, it } from "vitest";
import { estUrlHttp, estUrlStockageApp } from "./url-sure";

describe("estUrlHttp", () => {
  it("accepte http et https", () => {
    expect(estUrlHttp("https://exemple.fr/a.jpg")).toBe(true);
    expect(estUrlHttp("http://localhost:54321/a.jpg")).toBe(true);
  });

  it("refuse les autres schémas", () => {
    expect(estUrlHttp("javascript:alert(1)")).toBe(false);
    expect(estUrlHttp("data:text/html,<b>x</b>")).toBe(false);
    expect(estUrlHttp("file:///etc/passwd")).toBe(false);
    expect(estUrlHttp("ftp://exemple.fr/a")).toBe(false);
  });

  it("refuse le vide, les chemins relatifs et le texte libre", () => {
    expect(estUrlHttp("")).toBe(false);
    expect(estUrlHttp(null)).toBe(false);
    expect(estUrlHttp(undefined)).toBe(false);
    expect(estUrlHttp("/storage/a.jpg")).toBe(false);
    expect(estUrlHttp("pas une url")).toBe(false);
  });
});

describe("estUrlStockageApp", () => {
  it("exige l'hôte du stockage quand il est connu", () => {
    expect(estUrlStockageApp("https://x.supabase.co/storage/a.jpg", "x.supabase.co")).toBe(true);
    expect(estUrlStockageApp("https://autre.example/a.jpg", "x.supabase.co")).toBe(false);
  });

  it("se contente d'une URL HTTP(S) quand l'hôte du stockage n'est pas configuré", () => {
    expect(estUrlStockageApp("https://autre.example/a.jpg", null)).toBe(true);
    expect(estUrlStockageApp("javascript:alert(1)", null)).toBe(false);
  });
});
