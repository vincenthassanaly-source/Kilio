import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { TachesView } from "./TachesView";
import { queryKeys } from "@/lib/query/keys";
import { makeTache } from "@/test/fixtures";

vi.mock("@/app/actions/taches", () => ({
  getTachesAvecRelations: vi.fn(),
  getListes: vi.fn(),
  getTags: vi.fn(),
  createSousTache: vi.fn(),
  deleteSousTache: vi.fn(),
  deleteTache: vi.fn(),
  enregistrerOrdreTaches: vi.fn(),
  reordonnerSousTaches: vi.fn(),
  toggleSousTache: vi.fn(),
  setTacheFait: vi.fn(),
}));
// Hors sujet ici : formulaires d'ajout et geste de tirer-pour-rafraîchir.
vi.mock("../QuickAddFab", () => ({ QuickAddFab: () => null }));
vi.mock("./AddTaskToggle", () => ({ AddTaskToggle: () => null }));
vi.mock("./preloadAddTaskForm", () => ({ preloadAddTaskFormWhenIdle: () => () => {} }));
vi.mock("@/components/PullToRefresh", () => ({ PullToRefresh: ({ children }: { children: ReactNode }) => children }));

import { getListes, getTachesAvecRelations, getTags } from "@/app/actions/taches";

// Vitest tourne sans globals : RTL ne nettoie pas seul entre deux tests.
afterEach(() => {
  cleanup();
});

function monter(donneesEnCache: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (donneesEnCache) client.setQueryData(queryKeys.taches, [makeTache({ id: "t1", titre: "Payer le loyer" })]);
  render(
    <QueryClientProvider client={client}>
      <TachesView />
    </QueryClientProvider>
  );
}

describe("TachesView : actualisation en échec (CLICK-PATH T03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getListes).mockResolvedValue([]);
    vi.mocked(getTags).mockResolvedValue([]);
    vi.mocked(getTachesAvecRelations).mockRejectedValue(new Error("Failed to fetch"));
  });

  it("garde la liste du cache et prévient discrètement quand le rafraîchissement échoue", async () => {
    monter(true);

    expect(await screen.findByText("Actualisation impossible : dernières données affichées.")).toBeTruthy();
    expect(screen.getByText("Payer le loyer")).toBeTruthy();
    expect(screen.queryByText("Erreur de chargement des tâches. Réessaie.")).toBeNull();
  });

  it("affiche l'erreur de chargement quand il n'y a aucune donnée à montrer", async () => {
    monter(false);

    expect(await screen.findByText("Erreur de chargement des tâches. Réessaie.")).toBeTruthy();
    expect(screen.queryByText(/Actualisation impossible/)).toBeNull();
  });

  it("n'affiche aucun avertissement quand le chargement réussit", async () => {
    vi.mocked(getTachesAvecRelations).mockResolvedValue([makeTache({ id: "t1", titre: "Payer le loyer" })]);
    monter(false);

    expect(await screen.findByText("Payer le loyer")).toBeTruthy();
    await waitFor(() => expect(getTachesAvecRelations).toHaveBeenCalled());
    expect(screen.queryByText(/Actualisation impossible/)).toBeNull();
    expect(screen.queryByText("Erreur de chargement des tâches. Réessaie.")).toBeNull();
  });
});
