import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TasksList } from "./TasksList";
import { queryKeys } from "@/lib/query/keys";
import { makeTache } from "@/test/fixtures";

vi.mock("@/app/actions/taches", () => ({
  createSousTache: vi.fn(),
  deleteSousTache: vi.fn(),
  deleteTache: vi.fn(),
  enregistrerOrdreTaches: vi.fn(),
  reordonnerSousTaches: vi.fn(),
  toggleSousTache: vi.fn(),
  setTacheFait: vi.fn(),
}));
vi.mock("@/lib/offline/queue", () => ({
  enqueueAction: vi.fn(),
  isNetworkError: (err: unknown) => err instanceof Error && /failed to fetch/i.test(err.message),
}));
vi.mock("@/components/toast/toast-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/toast/toast-store")>();
  return { ...actual, showToast: vi.fn() };
});

import { setTacheFait } from "@/app/actions/taches";
import { enqueueAction } from "@/lib/offline/queue";
import { showToast } from "@/components/toast/toast-store";

// Vitest tourne sans globals : RTL ne nettoie pas seul entre deux tests.
afterEach(() => {
  cleanup();
});

function monter(tache = makeTache({ id: "t1", echeance: "2026-09-30", recurrence_frequence: "quotidien" })) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(queryKeys.taches, [tache]);
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <TasksList taches={[tache]} listes={[]} tags={[]} />
    </QueryClientProvider>
  );
  return { client, invalidateSpy };
}

describe("TaskCard : cocher une tâche (CLICK-PATH T01/T02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transmet l'échéance vue au serveur, garde d'idempotence des récurrentes (T01)", async () => {
    vi.mocked(setTacheFait).mockResolvedValue(undefined);
    const { invalidateSpy } = monter();

    await userEvent.click(screen.getByRole("button", { name: "Marquer fait" }));

    await waitFor(() => expect(setTacheFait).toHaveBeenCalledWith("t1", true, "2026-09-30"));
    expect(enqueueAction).not.toHaveBeenCalled();
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.taches }));
  });

  it("met en file la coche avec l'échéance vue, sans réactualiser depuis le serveur qui rétablirait l'ancien état (T01/T02)", async () => {
    vi.mocked(setTacheFait).mockRejectedValue(new Error("Failed to fetch"));
    vi.mocked(enqueueAction).mockResolvedValue(undefined);
    const { client, invalidateSpy } = monter();

    await userEvent.click(screen.getByRole("button", { name: "Marquer fait" }));

    await waitFor(() =>
      expect(enqueueAction).toHaveBeenCalledWith("taches", "setTacheFait", ["t1", true, "2026-09-30"])
    );
    expect(showToast).toHaveBeenCalledWith("Enregistré, sera synchronisé à la reconnexion");
    // L'état optimiste reste en cache jusqu'au rejeu de la file.
    await waitFor(() => {
      const cache = client.getQueryData<{ id: string; fait: boolean }[]>(queryKeys.taches);
      expect(cache?.[0].fait).toBe(true);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("réactualise et annule l'état optimiste quand le serveur répond par une vraie erreur", async () => {
    vi.mocked(setTacheFait).mockRejectedValue(new Error("boom"));
    const { client, invalidateSpy } = monter();

    await userEvent.click(screen.getByRole("button", { name: "Marquer fait" }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Impossible de mettre à jour la tâche."));
    expect(enqueueAction).not.toHaveBeenCalled();
    expect(client.getQueryData<{ fait: boolean }[]>(queryKeys.taches)?.[0].fait).toBe(false);
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.taches }));
  });
});
