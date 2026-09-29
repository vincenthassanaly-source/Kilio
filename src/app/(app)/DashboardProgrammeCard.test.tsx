import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/programme", () => ({ genererProgrammeDuJour: vi.fn() }));

import { genererProgrammeDuJour } from "@/app/actions/programme";
import { DashboardProgrammeCard } from "./DashboardProgrammeCard";

const generer = vi.mocked(genererProgrammeDuJour);

beforeEach(() => {
  vi.clearAllMocks();
});

// Vitest tourne sans globals : RTL ne nettoie pas seul entre deux tests.
afterEach(() => {
  cleanup();
});

describe("DashboardProgrammeCard", () => {
  it("affiche le créneau au-dessus de chaque suggestion qui en a un", async () => {
    generer.mockResolvedValue({
      ok: true,
      data: {
        intro: "Soirée tranquille.",
        propositions: [
          { texte: "Appeler la banque", source: "tache", creneau: "17:15–17:45" },
          { texte: "Idée libre", source: "general", creneau: null },
        ],
      },
    });
    const user = userEvent.setup();
    render(<DashboardProgrammeCard />);

    await user.click(screen.getByRole("button", { name: /Programme du jour/ }));

    expect(await screen.findByText("Appeler la banque")).toBeInTheDocument();
    expect(screen.getByText("17:15–17:45")).toBeInTheDocument();
    expect(screen.getByText("Idée libre")).toBeInTheDocument();
    // Une seule suggestion a un horaire.
    expect(screen.getAllByText(/^\d{2}:\d{2}–\d{2}:\d{2}$/)).toHaveLength(1);
  });

  it("échec : affiche la cause technique et propose de réessayer", async () => {
    generer.mockResolvedValue({
      ok: false,
      error: "La génération du programme a échoué. Réessaie. (Gemini a répondu 403 : API key not valid.)",
    });
    const user = userEvent.setup();
    render(<DashboardProgrammeCard />);

    await user.click(screen.getByRole("button", { name: /Programme du jour/ }));

    expect(await screen.findByText(/Gemini a répondu 403 : API key not valid\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("message calme sans suggestion", async () => {
    generer.mockResolvedValue({
      ok: true,
      data: { intro: "Il ne reste plus de plage libre aujourd'hui.", propositions: [] },
    });
    const user = userEvent.setup();
    render(<DashboardProgrammeCard />);

    await user.click(screen.getByRole("button", { name: /Programme du jour/ }));

    expect(await screen.findByText("Aucune suggestion pour l'instant.")).toBeInTheDocument();
  });
});
