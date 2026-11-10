import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { TachesView } from "./TachesView";
import { queryKeys } from "@/lib/query/keys";
import { makeTache } from "@/test/fixtures";
import { aujourdhuiISO } from "@/lib/date/recurrence";

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
vi.mock("./preloadAddTaskForm", () => ({ preloadAddTaskFormWhenIdle: () => () => {} }));
vi.mock("@/components/PullToRefresh", () => ({ PullToRefresh: ({ children }: { children: ReactNode }) => children }));

import { getListes, getTachesAvecRelations, getTags } from "@/app/actions/taches";

// Vitest tourne sans globals : RTL ne nettoie pas seul entre deux tests.
afterEach(() => {
  cleanup();
});

function monter(donneesEnCache: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (donneesEnCache) client.setQueryData(queryKeys.taches, [makeTache({ id: "t1", titre: "Payer le loyer", echeance: aujourdhuiISO() })]);
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
    expect(screen.getByText(/Payer le loyer/)).toBeTruthy();
    expect(screen.queryByText("Impossible de charger les tâches.")).toBeNull();
  });

  it("affiche l'erreur de chargement quand il n'y a aucune donnée à montrer", async () => {
    monter(false);

    expect(await screen.findByText("Impossible de charger les tâches.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByText(/Actualisation impossible/)).toBeNull();
  });

  it("n'affiche aucun avertissement quand le chargement réussit", async () => {
    vi.mocked(getTachesAvecRelations).mockResolvedValue([makeTache({ id: "t1", titre: "Payer le loyer", echeance: aujourdhuiISO() })]);
    monter(false);

    expect(await screen.findByText(/Payer le loyer/)).toBeTruthy();
    await waitFor(() => expect(getTachesAvecRelations).toHaveBeenCalled());
    expect(screen.queryByText(/Actualisation impossible/)).toBeNull();
    expect(screen.queryByText("Impossible de charger les tâches.")).toBeNull();
  });
});

describe("TachesView : vue « À faire » et compteur de retard", () => {
  const hier = new Date(Date.now() - 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const demain = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getListes).mockResolvedValue([]);
    vi.mocked(getTags).mockResolvedValue([]);
    vi.mocked(getTachesAvecRelations).mockResolvedValue([
      makeTache({ id: "a", titre: "Tâche du jour", echeance: aujourdhuiISO() }),
      makeTache({ id: "b", titre: "Tâche en retard", echeance: hier }),
      makeTache({ id: "c", titre: "Tâche future", echeance: demain }),
    ]);
  });

  it("s'ouvre sur « À faire » : le retard et aujourd'hui, pas le futur, le retard d'abord", async () => {
    monter(false);
    expect(await screen.findByText(/Tâche du jour/)).toBeTruthy();
    expect(screen.getByText(/Tâche en retard/)).toBeTruthy();
    expect(screen.queryByText(/Tâche future/)).toBeNull();
    const titres = screen.getAllByRole("button", { name: /\(modifier\)/ }).map((b) => b.textContent);
    expect(titres[0]).toContain("Tâche en retard");
  });

  it("affiche le retard en badge sur le segment, sans l'écrire dans le libellé", async () => {
    monter(false);
    await screen.findByText(/Tâche du jour/);
    const segment = screen.getByRole("button", { name: "Retard, 1" });
    expect(segment.textContent).toBe("Retard1");
  });

  it("n'annonce jamais « Rien à faire » quand du retard existe : la vue le contient", async () => {
    vi.mocked(getTachesAvecRelations).mockResolvedValue([makeTache({ id: "b", titre: "Tâche en retard", echeance: hier })]);
    monter(false);
    expect(await screen.findByText(/Tâche en retard/)).toBeTruthy();
    expect(screen.queryByText("Rien à faire pour l’instant.")).toBeNull();
  });
});
