import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CatalogueItem } from "@/lib/nutrition/compute";

vi.mock("@/app/actions/journal", () => ({
  addJournalEntry: vi.fn(),
  getCatalogueJournal: vi.fn().mockResolvedValue({ items: [], recents: [] }),
}));

import { AjoutRepasPanneau } from "./AjoutRepasPanneau";

const zero = { kcal: 0, proteines: 0, glucides: 0, lipides: 0 };
const oeuf: CatalogueItem = {
  type: "aliment",
  id: "a-oeuf",
  nom: "Œuf",
  categorie: null,
  unite: "piece",
  poidsUniteG: 60,
  par100: { ...zero, kcal: 140 },
};

function afficher(props: Partial<React.ComponentProps<typeof AjoutRepasPanneau>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AjoutRepasPanneau onAjoute={vi.fn()} {...props} />
    </QueryClientProvider>
  );
}

afterEach(() => cleanup());

describe("AjoutRepasPanneau — point de départ", () => {
  it("ouvre directement l'étape de quantité pour un aliment déjà choisi, avec sa quantité et son moment", () => {
    afficher({
      date: "2026-09-30",
      depart: { moment: "diner", item: oeuf, recent: { type: "aliment", id: "a-oeuf", quantite: 120, moment: "diner" } },
    });

    expect(screen.getByText("Œuf")).toBeInTheDocument();
    // 120 g = 2 pièces de 60 g : saisie en pièces.
    expect(screen.getByLabelText("Quantité")).toHaveValue("2");
    expect(screen.getByRole("button", { name: "Ajouter au dîner" })).toBeInTheDocument();
    expect(document.querySelector('input[name="date"]')).toHaveValue("2026-09-30");
  });

  it("pré-remplit la recherche quand rien n'est encore choisi", () => {
    afficher({ depart: { moment: "petit_dej", requete: "œufs brouillés" } });

    expect(screen.getByRole("searchbox", { name: "Rechercher un aliment ou une recette" })).toHaveValue("œufs brouillés");
  });

  it("sans point de départ : recherche vide, comme avant", () => {
    afficher();
    expect(screen.getByRole("searchbox", { name: "Rechercher un aliment ou une recette" })).toHaveValue("");
  });
});
