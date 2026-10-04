import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EnRetardSection } from "./EnRetardSection";
import { queryKeys } from "@/lib/query/keys";
import { getToasts } from "@/components/toast/toast-store";
import { makeTache } from "@/test/fixtures";

vi.mock("@/app/actions/taches", () => ({
  setTacheFait: vi.fn(),
  reporterTaches: vi.fn(),
  restaurerTaches: vi.fn(),
}));
vi.mock("@/lib/offline/queue", () => ({
  enqueueAction: vi.fn(),
  isNetworkError: () => false,
}));

import { reporterTaches, restaurerTaches } from "@/app/actions/taches";

afterEach(() => {
  cleanup();
});

const TODAY = "2026-10-04";

function taches(n: number) {
  return Array.from({ length: n }, (_, i) =>
    makeTache({ id: `t${i + 1}`, titre: `Retard ${i + 1}`, echeance: `2026-10-0${3 - Math.min(i, 2)}` })
  );
}

function monter(liste = taches(2)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(queryKeys.taches, liste);
  render(
    <QueryClientProvider client={client}>
      <EnRetardSection taches={liste} today={TODAY} />
    </QueryClientProvider>
  );
}

describe("EnRetardSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("n'affiche rien sans tâche en retard", () => {
    monter([]);
    expect(screen.queryByText("En retard")).toBeNull();
  });

  it("affiche le compteur et le retard de chaque tâche", () => {
    monter(taches(2));
    expect(screen.getByRole("heading", { name: "En retard" })).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("hier")).toBeTruthy();
  });

  it("replie au-delà de trois tâches et déplie à la demande", async () => {
    monter(taches(5));
    expect(screen.getByText("Retard 3")).toBeTruthy();
    expect(screen.queryByText("Retard 4")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Afficher les 2 autres" }));

    expect(screen.getByText("Retard 5")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réduire" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("reporte une tâche en un tap, avec un toast « Annuler » qui restaure l'état d'avant", async () => {
    vi.mocked(reporterTaches).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(restaurerTaches).mockResolvedValue({ ok: true, data: undefined });
    monter(taches(1));

    await userEvent.click(screen.getByRole("button", { name: "Reporter « Retard 1 » à demain" }));

    await waitFor(() => expect(reporterTaches).toHaveBeenCalledWith(["t1"], expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
    await waitFor(() => expect(getToasts().some((t) => t.text.includes("« Retard 1 » reportée à « demain »"))).toBe(true));

    const toast = getToasts().find((t) => t.action)!;
    toast.action!.onAction();

    await waitFor(() =>
      expect(restaurerTaches).toHaveBeenCalledWith([
        expect.objectContaining({ id: "t1", echeance: "2026-10-03" }),
      ])
    );
  });
});
