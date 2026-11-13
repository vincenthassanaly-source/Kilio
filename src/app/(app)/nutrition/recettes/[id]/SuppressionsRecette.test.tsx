import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";

vi.mock("@/app/actions/recette-ingredients", () => ({
  addIngredient: vi.fn(),
  removeIngredient: vi.fn(),
  updateIngredient: vi.fn(),
}));
vi.mock("@/app/actions/recette-ingredients-libres", () => ({
  addIngredientLibre: vi.fn(),
  removeIngredientLibre: vi.fn(),
  updateIngredientLibre: vi.fn(),
}));
vi.mock("@/app/actions/recette-etapes", () => ({ addEtape: vi.fn(), removeEtape: vi.fn(), updateEtape: vi.fn() }));

import { removeIngredient } from "@/app/actions/recette-ingredients";
import { removeIngredientLibre } from "@/app/actions/recette-ingredients-libres";
import { removeEtape } from "@/app/actions/recette-etapes";
import { EtapesManager } from "./EtapesManager";
import { IngredientManager } from "./IngredientManager";
import { IngredientsLibresManager } from "./IngredientsLibresManager";

const ETAPES = [
  { id: "e1", titre: null, consigne: "Couper les oignons", astuce: null },
  { id: "e2", titre: null, consigne: "Faire revenir", astuce: null },
] as never;
const INGREDIENTS = [{ id: "i1", quantite: 200, unite: "g", aliment: { id: "a1", nom: "Pois chiches" } }] as never;
const LIBRES = [{ id: "l1", nom: "Sel", quantite: "1 pincée" }] as never;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  for (const [type, id] of [
    ["recette-etape", "e1"],
    ["recette-ingredient", "i1"],
    ["recette-ingredient-libre", "l1"],
  ]) {
    reafficherElement(type, id);
  }
  vi.clearAllMocks();
});

async function apresDelai(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("EtapesManager : suppression avec annulation différée", () => {
  function supprimerPremiereEtape() {
    vi.mocked(removeEtape).mockResolvedValue(undefined as never);
    render(<EtapesManager recetteId="rec-1" etapes={ETAPES} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer l'étape 1" }));
  }

  it("retire l'étape tout de suite (les suivantes se renumérotent), sans confirmation ni appel serveur", () => {
    supprimerPremiereEtape();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Couper les oignons")).not.toBeInTheDocument();
    expect(screen.getByText("Faire revenir")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer l'étape 1" })).toBeInTheDocument();
    expect(removeEtape).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Étape 1 supprimée");
  });

  it("« Annuler » remet l'étape sans appel serveur", async () => {
    supprimerPremiereEtape();
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getByText("Couper les oignons")).toBeInTheDocument();
    await apresDelai(10_000);
    expect(removeEtape).not.toHaveBeenCalled();
  });

  it("supprime l'étape après le délai", async () => {
    supprimerPremiereEtape();
    await apresDelai(6100);
    expect(removeEtape).toHaveBeenCalledWith("e1", "rec-1");
  });
});

describe("IngredientManager : suppression avec annulation différée", () => {
  function supprimer() {
    vi.mocked(removeIngredient).mockResolvedValue(undefined as never);
    render(<IngredientManager recetteId="rec-1" ingredients={INGREDIENTS} aliments={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer l'ingrédient « Pois chiches »" }));
  }

  it("retire la ligne tout de suite, sans confirmation ni appel serveur", () => {
    supprimer();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Pois chiches")).not.toBeInTheDocument();
    expect(removeIngredient).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Ingrédient « Pois chiches » supprimé");
  });

  it("« Annuler » remet l'ingrédient sans appel serveur", async () => {
    supprimer();
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getByText("Pois chiches")).toBeInTheDocument();
    await apresDelai(10_000);
    expect(removeIngredient).not.toHaveBeenCalled();
  });

  it("supprime l'ingrédient après le délai", async () => {
    supprimer();
    await apresDelai(6100);
    expect(removeIngredient).toHaveBeenCalledWith("i1", "rec-1");
  });
});

describe("IngredientsLibresManager : suppression avec annulation différée", () => {
  function supprimer() {
    vi.mocked(removeIngredientLibre).mockResolvedValue(undefined as never);
    render(<IngredientsLibresManager recetteId="rec-1" ingredients={LIBRES} />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer l'ingrédient « Sel »" }));
  }

  it("retire la ligne tout de suite, sans confirmation ni appel serveur", () => {
    supprimer();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("1 pincée")).not.toBeInTheDocument();
    expect(removeIngredientLibre).not.toHaveBeenCalled();
  });

  it("« Annuler » remet l'ingrédient sans appel serveur", async () => {
    supprimer();
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getByText("1 pincée")).toBeInTheDocument();
    await apresDelai(10_000);
    expect(removeIngredientLibre).not.toHaveBeenCalled();
  });

  it("supprime l'ingrédient après le délai", async () => {
    supprimer();
    await apresDelai(6100);
    expect(removeIngredientLibre).toHaveBeenCalledWith("l1", "rec-1");
  });
});
