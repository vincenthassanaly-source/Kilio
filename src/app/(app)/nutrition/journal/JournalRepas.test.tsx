import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { zeroNutrition } from "@/lib/nutrition/compute";
import type { JournalEntryView } from "./JournalEntriesList";

const mocks = vi.hoisted(() => ({ restaurer: vi.fn() }));

vi.mock("@/app/actions/journal", () => ({ removeJournalEntry: vi.fn(), updateJournalEntry: vi.fn() }));
vi.mock("./AjoutRepasPanneau", () => ({
  AjoutRepasPanneau: ({ edition }: { edition: { id: string; cle: string; quantite: number; moment: string } }) => (
    <p data-testid="edition">{`${edition.id} ${edition.cle} ${edition.quantite} ${edition.moment}`}</p>
  ),
}));
vi.mock("@/lib/actions/suppressionDifferee", () => ({
  // Masque tout de suite, comme le vrai ; l'expiration du délai n'est pas jouée.
  supprimerAvecAnnulation: ({ masquer, restaurer }: { masquer: () => void; restaurer: () => void }) => {
    masquer();
    mocks.restaurer.mockImplementation(restaurer);
  },
}));
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
    cle: `aliment:al-${id}`,
    quantite: 100,
  };
}

function rendre(entries: JournalEntryView[]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JournalRepas entries={entries} cible={null} date="2026-11-10" jourType="repos" />
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

  it("affiche l'état vide, sans second bouton d'ajout, quand le dernier repas est masqué", async () => {
    rendre([entree("a", 300)]);

    await userEvent.click(screen.getByRole("button", { name: /^Supprimer « Repas / }));

    expect(screen.getByText("Aucun repas enregistré pour ce jour.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ajouter un repas" })).toBeNull();
    expect(screen.getByTestId("kcal").textContent).toBe("0");
  });

  it("nomme le type de jour dans le titre et groupe les repas par moment avec leur sous-total", () => {
    rendre([entree("a", 300), entree("b", 200)]);
    expect(screen.getByRole("heading", { name: "Résumé du jour · repos" })).toBeTruthy();
    expect(screen.getAllByText("Déjeuner")).toHaveLength(1);
    expect(screen.getByText("500 kcal")).toBeTruthy();
  });

  it("rouvre le dosage pré-rempli au tap sur un repas", async () => {
    rendre([entree("a", 300)]);

    await userEvent.click(screen.getByRole("button", { name: "Modifier « Repas a », 100 g" }));

    expect((await screen.findByTestId("edition")).textContent).toBe("a aliment:al-a 100 dejeuner");
  });
});
