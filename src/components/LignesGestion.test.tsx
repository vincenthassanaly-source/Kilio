import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Les Server Actions importent Supabase, sharp… : inutiles pour un test de mise en page.
vi.mock("@/app/actions/documents-categories", () => ({
  creerCategorie: vi.fn(),
  fusionnerCategories: vi.fn(),
  renommerCategorie: vi.fn(),
  supprimerCategorie: vi.fn(),
}));
vi.mock("@/app/actions/recette-etapes", () => ({ addEtape: vi.fn(), removeEtape: vi.fn(), updateEtape: vi.fn() }));
vi.mock("@/app/actions/recette-ingredients-libres", () => ({
  addIngredientLibre: vi.fn(),
  removeIngredientLibre: vi.fn(),
  updateIngredientLibre: vi.fn(),
}));
vi.mock("@/app/actions/recette-ingredients", () => ({
  addIngredient: vi.fn(),
  removeIngredient: vi.fn(),
  updateIngredient: vi.fn(),
}));

import { CategoriesManager } from "@/app/(app)/documents/categories/CategoriesManager";
import { EtapesManager } from "@/app/(app)/nutrition/recettes/[id]/EtapesManager";
import { IngredientsLibresManager } from "@/app/(app)/nutrition/recettes/[id]/IngredientsLibresManager";

// Régression : sur l'ancien écran Étiquettes, un nom long (« Attestation
// d'assurance habitation ») repoussait « Modifier » et « Suppr. » hors de la
// carte, où ils étaient coupés. Le nom passe maintenant à la ligne, en entier
// (deux noms qui ne diffèrent qu'à la fin restent distinguables), et les boutons
// forment une rangée alignée à droite sous le texte (Catégories, Recettes).
const NOM_LONG = "Attestation d'assurance habitation avec un nom vraiment très très long";

/** Vérifie la disposition d'une ligne : nom complet, boutons dans une rangée dédiée. */
function verifierLigne(nom: HTMLElement, boutons: string[]) {
  expect(nom.className).not.toContain("truncate");
  expect(nom.className).toContain("break-words");

  const rangee = screen.getByRole("button", { name: boutons[0] }).parentElement as HTMLElement;
  expect(rangee.className).toContain("justify-end");
  expect(rangee.className).not.toContain("shrink-0");
  for (const intitule of boutons) {
    expect(screen.getByRole("button", { name: intitule }).parentElement).toBe(rangee);
  }
  // La rangée n'est pas dans le bloc du nom : elle est en dessous, pas à côté.
  expect(rangee.contains(nom)).toBe(false);
}

afterEach(cleanup);

describe("lignes de gestion avec un nom long", () => {
  it("Catégories : trois boutons dans la même rangée sous le nom", () => {
    render(
      <CategoriesManager
        categories={[
          { id: "C1", nom: NOM_LONG, created_at: "", nb: 2 },
          { id: "C2", nom: "Autre", created_at: "", nb: 0 },
        ]}
      />
    );
    const nom = screen.getByText(NOM_LONG);
    const ligne = nom.closest("li") as HTMLElement;
    expect(ligne).not.toBeNull();
    expect(nom.className).not.toContain("truncate");
    const rangee = ligne.querySelector("button")!.parentElement as HTMLElement;
    expect(rangee.className).toContain("justify-end");
    expect(Array.from(rangee.querySelectorAll("button")).map((b) => b.textContent)).toEqual([
      "Modifier",
      "Fusionner",
      "Suppr.",
    ]);
  });

  it("Ingrédients libres : le nom reste entier et les boutons sont dans leur rangée", () => {
    render(
      <IngredientsLibresManager
        recetteId="R1"
        ingredients={[{ id: "I1", recette_id: "R1", nom: NOM_LONG, quantite: "1 sachet" } as never]}
      />
    );
    verifierLigne(screen.getByText(NOM_LONG), ["Éditer", "Suppr."]);
  });

  it("Étapes : l'intitulé de l'étape passe à la ligne et les boutons sont dans leur rangée", () => {
    render(
      <EtapesManager
        recetteId="R1"
        etapes={[{ id: "S1", recette_id: "R1", titre: NOM_LONG, consigne: "Mélanger", astuce: null, ordre: 1 } as never]}
      />
    );
    verifierLigne(screen.getByText(new RegExp(NOM_LONG)), ["Éditer", "Suppr."]);
  });
});
