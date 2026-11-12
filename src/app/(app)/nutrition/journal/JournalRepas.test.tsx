import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { zeroNutrition } from "@/lib/nutrition/compute";
import type { JournalEntryView } from "./JournalEntriesList";

const mocks = vi.hoisted(() => ({ restaurer: vi.fn() }));

vi.mock("@/app/actions/journal", () => ({ removeJournalEntry: vi.fn() }));
vi.mock("@/lib/actions/suppressionDifferee", () => ({
  // Masque tout de suite, comme le vrai ; l'expiration du délai n'est pas jouée.
  supprimerAvecAnnulation: ({ masquer, restaurer }: { masquer: () => void; restaurer: () => void }) => {
    masquer();
    mocks.restaurer.mockImplementation(restaurer);
  },
}));
vi.mock("./AjoutRepasBouton", () => ({ AjoutRepasBouton: () => <button>Ajouter un repas</button> }));
vi.mock("./ResumeJour", () => ({
  ResumeJour: ({ consomme }: { consomme: { kcal: number } }) => <p data-testid="kcal">{consomme.kcal}</p>,
}));

import { JournalRepas } from "./JournalRepas";

function entree(id: string, kcal: number): JournalEntryView {
  return {
    id,
    moment: "dejeuner",
    label: `Repas ${id}`,
    detail: "100 g",
    nutrition: { ...zeroNutrition(), kcal },
  };
}

function rendre(entries: JournalEntryView[]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JournalRepas entries={entries} cible={null} date="2026-11-10" />
    </QueryClientProvider>
  );
}

describe("JournalRepas", () => {
  afterEach(cleanup);

  it("retire un repas supprimé du résumé tout de suite", async () => {
    rendre([entree("a", 300), entree("b", 200)]);
    expect(screen.getByTestId("kcal").textContent).toBe("500");

    await userEvent.click(screen.getAllByRole("button", { name: /^Supprimer « Repas / })[0]);

    expect(screen.getByTestId("kcal").textContent).toBe("200");
  });

  it("affiche l'état vide avec son bouton quand le dernier repas est masqué", async () => {
    rendre([entree("a", 300)]);

    await userEvent.click(screen.getByRole("button", { name: /^Supprimer « Repas / }));

    expect(screen.getByText("Aucun repas enregistré pour ce jour.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter un repas" })).toBeTruthy();
    expect(screen.getByTestId("kcal").textContent).toBe("0");
  });
});
