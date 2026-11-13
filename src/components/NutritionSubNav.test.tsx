import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NutritionSubNav } from "./NutritionSubNav";

let pathnameMock = "/nutrition";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => pathnameMock,
}));

afterEach(() => {
  cleanup();
});

function actif() {
  return screen
    .getAllByRole("link")
    .filter((lien) => lien.getAttribute("aria-current") === "page")
    .map((lien) => lien.getAttribute("href"));
}

describe("NutritionSubNav", () => {
  it("propose les quatre sections, Bilan, Menus et Recettes incluses", () => {
    render(<NutritionSubNav />);
    expect(screen.getAllByRole("link").map((lien) => lien.getAttribute("href"))).toEqual([
      "/nutrition/journal",
      "/nutrition/bilan",
      "/nutrition/recettes",
      "/nutrition/menus",
    ]);
  });

  it("marque le Carnet actif sur /nutrition, l'onglet de la barre du bas qui ouvre le Carnet", () => {
    pathnameMock = "/nutrition";
    render(<NutritionSubNav />);
    expect(actif()).toEqual(["/nutrition/journal"]);
  });

  it.each([
    ["/nutrition/journal", "/nutrition/journal"],
    ["/nutrition/bilan", "/nutrition/bilan"],
    ["/nutrition/recettes/abc", "/nutrition/recettes"],
    ["/nutrition/menus", "/nutrition/menus"],
  ])("marque la section de %s", (pathname, attendu) => {
    pathnameMock = pathname;
    render(<NutritionSubNav />);
    expect(actif()).toEqual([attendu]);
  });
});
