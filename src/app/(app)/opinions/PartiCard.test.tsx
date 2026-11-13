import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";
import type { PartiComplet } from "@/lib/opinions/partis";

vi.mock("@/app/actions/opinions-partis", () => ({
  definirSuiviProposition: vi.fn(),
  reprendreProposition: vi.fn(),
  supprimerParti: vi.fn(),
  supprimerProgramme: vi.fn(),
  supprimerProposition: vi.fn(),
}));
vi.mock("@/hooks/useViewTransitionNavigate", () => ({ useViewTransitionNavigate: () => vi.fn() }));
vi.mock("./PartisForms", () => ({
  PartiFormModal: () => null,
  ProgrammeFormModal: () => null,
  PropositionFormModal: () => null,
}));

import { supprimerParti, supprimerProgramme } from "@/app/actions/opinions-partis";
import { PartiCard } from "./PartiCard";

const SCORES = { economie: null, social: null, ecologie: null, europe: null, securite: null, institutions: null };
const PARTI = {
  id: "p1",
  nom: "Parti Test",
  sigle: "PT",
  couleur: "bleu",
  programmes: [
    {
      id: "pr1",
      echeance: "Présidentielle 2027",
      date_programme: null,
      created_at: "2026-01-01T00:00:00Z",
      propositions: [
        { id: "x1", position: "Une proposition", theme: "economie", scores: SCORES, termes: [], explication: null, lu: false, favori: false },
        { id: "x2", position: "Une autre", theme: "economie", scores: SCORES, termes: [], explication: null, lu: false, favori: false },
      ],
    },
  ],
} as unknown as PartiComplet;

function ouvrir() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PartiCard parti={PARTI} proximite={null} />
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: /PT/ }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(supprimerParti).mockResolvedValue({ ok: true, data: undefined });
  vi.mocked(supprimerProgramme).mockResolvedValue({ ok: true, data: undefined });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("parti", "p1");
  reafficherElement("programme", "pr1");
  vi.clearAllMocks();
});

describe("PartiCard : suppressions avec annulation différée", () => {
  it("supprimer le parti : sans boîte de confirmation ni appel serveur, avec le nombre de programmes dans le toast", async () => {
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le parti" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(supprimerParti).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Parti « PT » supprimé avec son programme");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(supprimerParti).toHaveBeenCalledWith("p1");
  });

  it("supprimer le parti puis « Annuler » : aucun appel serveur", async () => {
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le parti" }));
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(supprimerParti).not.toHaveBeenCalled();
  });

  it("supprimer le programme : toast avec le nombre de propositions, appel après le délai seulement", async () => {
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(supprimerProgramme).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Programme « Présidentielle 2027 » supprimé avec ses 2 propositions");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(supprimerProgramme).toHaveBeenCalledWith("pr1");
  });
});
