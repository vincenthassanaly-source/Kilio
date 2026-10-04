import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TasksList } from "./TasksList";
import { queryKeys } from "@/lib/query/keys";
import { makeTache } from "@/test/fixtures";
import { getToasts } from "@/components/toast/toast-store";
import { reafficherTaches } from "@/lib/taches/masquees";

vi.mock("@/app/actions/taches", () => ({
  annulerCochage: vi.fn(),
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
  isNetworkError: () => false,
}));

import { annulerCochage, deleteTache, setTacheFait } from "@/app/actions/taches";

afterEach(() => {
  cleanup();
  reafficherTaches(["t1"]);
});

function monter(tache = makeTache({ id: "t1", titre: "Appeler le dentiste" })) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(queryKeys.taches, [tache]);
  render(
    <QueryClientProvider client={client}>
      <TasksList taches={[tache]} listes={[]} tags={[]} />
    </QueryClientProvider>
  );
}

function toastAvecAction(fragment: string) {
  const toast = getToasts().find((t) => t.text.includes(fragment) && t.action);
  if (!toast?.action) throw new Error(`Toast d'action « ${fragment} » introuvable`);
  return toast.action;
}

describe("TaskCard : annuler une suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("masque la carte sans confirmation bloquante ni appel serveur immédiat, « Annuler » la réaffiche", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    monter();

    await userEvent.click(screen.getByRole("button", { name: "Suppr." }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("Appeler le dentiste")).toBeNull();
    expect(deleteTache).not.toHaveBeenCalled();

    act(() => toastAvecAction("« Appeler le dentiste » supprimée").onAction());

    expect(await screen.findByText("Appeler le dentiste")).toBeTruthy();
    expect(deleteTache).not.toHaveBeenCalled();
  });
});

describe("TaskCard : annuler une coche", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propose « Annuler » après une coche et décoche côté serveur", async () => {
    vi.mocked(setTacheFait).mockResolvedValue(undefined);
    vi.mocked(annulerCochage).mockResolvedValue({ ok: true, data: undefined });
    monter();

    await userEvent.click(screen.getByRole("button", { name: "Marquer fait" }));
    await waitFor(() => expect(setTacheFait).toHaveBeenCalled());

    await waitFor(() => expect(() => toastAvecAction("faite")).not.toThrow());
    act(() => toastAvecAction("faite").onAction());

    await waitFor(() => expect(annulerCochage).toHaveBeenCalledWith("t1", false, undefined));
  });

  it("restaure l'échéance d'une tâche récurrente que la coche avait avancée", async () => {
    vi.mocked(setTacheFait).mockResolvedValue(undefined);
    vi.mocked(annulerCochage).mockResolvedValue({ ok: true, data: undefined });
    monter(makeTache({ id: "t1", titre: "Arroser", echeance: "2026-09-30", recurrence_frequence: "quotidien" }));

    await userEvent.click(screen.getByRole("button", { name: "Marquer fait" }));
    await waitFor(() => expect(() => toastAvecAction("« Arroser » faite")).not.toThrow());
    act(() => toastAvecAction("« Arroser » faite").onAction());

    await waitFor(() => expect(annulerCochage).toHaveBeenCalledWith("t1", false, "2026-09-30"));
  });
});
