import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlanDuJourCard } from "./PlanDuJourCard";
import { getToasts } from "@/components/toast/toast-store";
import { makeTache } from "@/test/fixtures";

vi.mock("@/app/actions/taches", () => ({
  planifierTache: vi.fn(),
  restaurerPlanification: vi.fn(),
}));

import { planifierTache, restaurerPlanification } from "@/app/actions/taches";

afterEach(() => cleanup());

const TODAY = "2026-10-09";
const LIBRES = [{ debut: "14:00", fin: "17:00" }];

function monter(taches = [makeTache({ id: "a", titre: "Facture", echeance: "2026-10-07", priorite: "haute", duree_minutes: 60 }), makeTache({ id: "b", titre: "Appeler Paul", echeance: TODAY })], libres = LIBRES) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlanDuJourCard taches={taches} libres={libres} today={TODAY} />
    </QueryClientProvider>
  );
}

describe("PlanDuJourCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ne s'affiche pas sans tâche à placer", () => {
    monter([makeTache({ echeance: "2026-10-12" })]);
    expect(screen.queryByText("Plan du jour")).toBeNull();
  });

  it("propose les tâches par priorité dans les trous libres", () => {
    monter();
    expect(screen.getByRole("button", { name: "Placer « Facture » de 14:00 à 15:00" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Placer « Appeler Paul » de 15:00 à 15:30" })).toBeTruthy();
  });

  it("« Tout placer » planifie chaque tâche puis « Annuler » rétablit l'état d'avant", async () => {
    vi.mocked(planifierTache).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(restaurerPlanification).mockResolvedValue({ ok: true, data: undefined });
    monter();

    await userEvent.click(screen.getByRole("button", { name: "Tout placer" }));

    await waitFor(() => expect(planifierTache).toHaveBeenCalledTimes(2));
    expect(planifierTache).toHaveBeenNthCalledWith(1, "a", TODAY, "14:00", 60, false);
    expect(planifierTache).toHaveBeenNthCalledWith(2, "b", TODAY, "15:00", 30, true);

    const toast = getToasts().find((t) => t.text.includes("2 tâches planifiées"))!;
    toast.action!.onAction();
    await waitFor(() => expect(restaurerPlanification).toHaveBeenCalledTimes(2));
    expect(restaurerPlanification).toHaveBeenCalledWith("a", expect.objectContaining({ echeance: "2026-10-07" }));
  });

  it("indique quand rien ne tient aujourd'hui", () => {
    monter(undefined, []);
    expect(screen.getByText(/Aucun trou libre aujourd'hui/)).toBeTruthy();
  });

  it("se masque à la demande", async () => {
    monter();
    await userEvent.click(screen.getByRole("button", { name: "Masquer" }));
    expect(screen.queryByText("Plan du jour")).toBeNull();
  });
});
