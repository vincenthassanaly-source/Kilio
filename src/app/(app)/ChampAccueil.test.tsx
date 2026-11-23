import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChampAccueil } from "./ChampAccueil";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/actions/saisie", () => ({ interpreterSaisie: vi.fn() }));
vi.mock("@/app/actions/recherche", () => ({ rechercheGlobale: vi.fn(async () => []) }));
vi.mock("@/app/actions/taches", () => ({ createTache: vi.fn(), createSousTache: vi.fn(), getListes: vi.fn(async () => []) }));
vi.mock("@/app/actions/evenements", () => ({ createEvenement: vi.fn() }));

afterEach(() => cleanup());

function rendre() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChampAccueil />
    </QueryClientProvider>
  );
}

describe("ChampAccueil", () => {
  it("un seul champ : saisie « Ajoute… » par défaut, recherche au choix", () => {
    rendre();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByPlaceholderText(/Ajoute…/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mode ajout" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Mode recherche" }));

    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.queryByPlaceholderText(/Ajoute…/)).toBeNull();
    expect(screen.getByRole("button", { name: "Mode recherche" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("garde le texte tapé en changeant de mode", () => {
    rendre();
    fireEvent.change(screen.getByPlaceholderText(/Ajoute…/), { target: { value: "dentiste" } });
    fireEvent.click(screen.getByRole("button", { name: "Mode recherche" }));
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("dentiste");
    fireEvent.click(screen.getByRole("button", { name: "Mode ajout" }));
    expect((screen.getByPlaceholderText(/Ajoute…/) as HTMLInputElement).value).toBe("dentiste");
  });
});
