import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/recette-ingredients", () => ({
  addIngredient: vi.fn(),
  removeIngredient: vi.fn(),
  updateIngredient: vi.fn(),
}));

import { IngredientManager } from "./IngredientManager";

const macros = { kcal_100g: 100, proteines_100g: 5, glucides_100g: 10, lipides_100g: 2 };
const ALIMENTS = [
  { id: "a1", nom: "Pois chiches", categorie: "Légumineuses", unite: "g", poids_unite_g: null, ...macros },
  { id: "a2", nom: "Œuf", categorie: null, unite: "piece", poids_unite_g: 60, ...macros },
] as never;
const INGREDIENTS = [{ id: "i1", quantite: 1.5, unite: "piece", aliment: { id: "a2", nom: "Œuf" } }] as never;

afterEach(cleanup);

function rendre() {
  render(<IngredientManager recetteId="r1" ingredients={INGREDIENTS} aliments={ALIMENTS} />);
}

describe("IngredientManager", () => {
  it("choisit l'ingrédient par une recherche tolérante aux accents, puis demande la quantité", async () => {
    rendre();
    expect(screen.queryByLabelText("Quantité")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher un ingrédient" }), { target: { value: "legumi" } });
    fireEvent.click(await screen.findByRole("button", { name: "Pois chiches" }));

    expect(document.querySelector('input[name="aliment_id"]')).toHaveValue("a1");
    expect(document.querySelector('input[name="unite"]')).toHaveValue("g");
    expect(screen.getByLabelText("Quantité")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter l'ingrédient" })).toBeEnabled();
  });

  it("affiche les quantités au format français et « Retirer » pour un ingrédient", () => {
    rendre();
    expect(screen.getByText("1,5 pièce")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer « Œuf »" }).textContent).toBe("Retirer");
  });
});
