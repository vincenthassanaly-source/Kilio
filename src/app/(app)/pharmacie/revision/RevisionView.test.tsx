import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PharmaSnapshot } from "@/lib/pharmacie/types";

const noterCarte = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/actions/pharmacie", () => ({
  noterCarte: (...args: unknown[]) => noterCarte(...args),
  modifierNotion: vi.fn(),
  supprimerNotion: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/pharmacie/revision",
}));
vi.mock("@/lib/offline/queue", () => ({ enqueueAction: vi.fn(), isNetworkError: () => false }));

const toasts: { text: string; onAction: () => void }[] = [];
vi.mock("@/components/toast/toast-store", () => ({
  showActionToast: (text: string, { onAction }: { onAction: () => void }) => {
    toasts.push({ text, onAction });
    return toasts.length;
  },
  showErrorToast: vi.fn(),
  showToast: vi.fn(),
  dismissToast: vi.fn(),
}));

let snapshot: PharmaSnapshot;
vi.mock("@/lib/pharmacie/useSnapshotPharmacie", () => ({
  useSnapshotPharmacie: () => ({ data: snapshot, isLoading: false, isError: false, refetch: vi.fn() }),
  modifierSnapshot: vi.fn(),
}));

import { RevisionView } from "./RevisionView";

function carte(id: string, question: string) {
  return {
    id,
    notion_id: "n1",
    molecule_id: null,
    question,
    reponse: `Réponse ${id}`,
    echeance: "2026-01-01T00:00:00.000Z",
    intervalle_jours: 0,
    facilite: 2.5,
    repetitions: 0,
    dernier_passage: null,
  };
}

function rendre() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <RevisionView />
    </QueryClientProvider>,
  );
}

describe("RevisionView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    toasts.length = 0;
    noterCarte.mockClear();
    snapshot = {
      matieres: [],
      chapitres: [],
      notions: [{ id: "n1", chapitre_id: "c1", titre: "Glycémie", contenu: "x", tags: [] }],
      cartes: [carte("a", "Question A"), carte("b", "Question B")],
      genereLe: "2026-11-23T00:00:00.000Z",
    } as unknown as PharmaSnapshot;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("« Annuler » ramène la carte précédente sans rien envoyer au serveur", () => {
    rendre();
    expect(screen.getByText("Question A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voir la réponse" }));
    fireEvent.click(screen.getByRole("button", { name: /^Bien/ }));
    expect(screen.getByText("Question B")).toBeInTheDocument();
    expect(toasts.at(-1)?.text).toBe("Carte notée « Bien »");

    act(() => toasts.at(-1)!.onAction());
    expect(screen.getByText("Question A")).toBeInTheDocument();
    // Réponse de nouveau affichée : on peut noter autrement.
    expect(screen.getByText("Réponse a")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10_000));
    expect(noterCarte).not.toHaveBeenCalled();
  });

  it("envoie la note à la fin du délai d'annulation", () => {
    rendre();
    fireEvent.click(screen.getByRole("button", { name: "Voir la réponse" }));
    fireEvent.click(screen.getByRole("button", { name: /^Facile/ }));
    expect(noterCarte).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(6000));
    expect(noterCarte).toHaveBeenCalledWith("a", "facile", expect.any(String));
  });

  it("affiche un lien « Modifier la notion » et une seule progression", () => {
    rendre();
    expect(screen.getByRole("button", { name: "Modifier la notion Glycémie" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progression de la séance" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByText(/restante/)).not.toBeInTheDocument();
  });
});
