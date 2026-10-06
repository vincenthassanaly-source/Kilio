import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db: { recettes: Row | null; libres: Row[]; etapes: Row[]; liens: Row[] } = {
  recettes: null,
  libres: [],
  etapes: [],
  liens: [],
};

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const result = () => {
        if (table === "recettes") return { data: db.recettes };
        if (table === "recette_ingredients") return { data: db.liens };
        if (table === "recette_ingredients_libres") return { data: db.libres };
        if (table === "recette_etapes") return { data: db.etapes };
        return { data: [] };
      };
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => Promise.resolve(result());
      chain.maybeSingle = () => Promise.resolve(result());
      return chain;
    },
  }),
}));
vi.mock("./RecetteHeader", () => ({ RecetteHeader: () => null }));
vi.mock("./RecetteMacros", () => ({ RecetteMacros: () => null }));
vi.mock("./IngredientManager", () => ({
  IngredientManager: ({ hideEmptyMessage }: { hideEmptyMessage?: boolean }) => (
    <div data-testid="liens">{hideEmptyMessage ? "" : "Aucun ingrédient pour l'instant."}</div>
  ),
}));
vi.mock("./IngredientsLibresManager", () => ({
  IngredientsLibresManager: () => <div data-testid="libres" />,
}));
vi.mock("./EtapesManager", () => ({ EtapesManager: () => <div data-testid="etapes" /> }));

import RecetteDetailPage from "./page";

async function renderPage() {
  const ui = await RecetteDetailPage({ params: Promise.resolve({ id: "r1" }) });
  render(ui);
}

const base = { id: "r1", nom: "R", portions: 2, temps_prepa_min: null };

afterEach(cleanup);

beforeEach(() => {
  db.recettes = null;
  db.libres = [];
  db.etapes = [];
  db.liens = [];
});

describe("RecetteDetailPage", () => {
  it("manuel avec libres, étapes, ustensiles : tout s'affiche, sans message vide", async () => {
    db.recettes = { ...base, source: "manuel", ustensiles: ["Fouet", "Bol"] };
    db.libres = [{ id: "1", nom: "Œufs", quantite: "4", ordre: 1 }];
    db.etapes = [{ id: "1", ordre: 1, titre: "t", consigne: "c", astuce: null }];
    await renderPage();
    expect(screen.getByText("Ustensiles")).toBeTruthy();
    expect(screen.getByText("Fouet")).toBeTruthy();
    expect(screen.getByTestId("libres")).toBeTruthy();
    expect(screen.getByTestId("etapes")).toBeTruthy();
    expect(screen.queryByText("Aucun ingrédient pour l'instant.")).toBeNull();
  });

  it("manuel sans libres ni étapes ni ustensiles : pas de section vide, message conservé", async () => {
    db.recettes = { ...base, source: "manuel", ustensiles: null };
    await renderPage();
    expect(screen.queryByText("Ustensiles")).toBeNull();
    expect(screen.queryByText("Étapes")).toBeNull();
    expect(screen.queryByTestId("libres")).toBeNull();
    expect(screen.getByText("Aucun ingrédient pour l'instant.")).toBeTruthy();
  });

  it("hellofresh : comportement inchangé (libres + étapes toujours rendus, pas de liens)", async () => {
    db.recettes = { ...base, source: "hellofresh", ustensiles: ["Poêle"] };
    await renderPage();
    expect(screen.getByText("Poêle")).toBeTruthy();
    expect(screen.getByTestId("libres")).toBeTruthy();
    expect(screen.getByTestId("etapes")).toBeTruthy();
    expect(screen.queryByTestId("liens")).toBeNull();
  });
});
