import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlanifierPanneau } from "./PlanifierPanneau";
import { getToasts } from "@/components/toast/toast-store";
import { makeTache } from "@/test/fixtures";

vi.mock("@/app/actions/taches", () => ({
  planifierTache: vi.fn(),
  restaurerPlanification: vi.fn(),
}));

import { planifierTache, restaurerPlanification } from "@/app/actions/taches";

afterEach(() => {
  cleanup();
});

const LIBRES = [
  { debut: "16:10", fin: "18:30" },
  { debut: "20:00", fin: "22:00" },
];

function monter(tache = makeTache({ id: "t1", titre: "Ranger le bureau" }), libres = LIBRES) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlanifierPanneau tache={tache} today="2026-10-04" libres={libres} onClose={onClose} />
    </QueryClientProvider>
  );
  return { onClose };
}

describe("PlanifierPanneau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propose des créneaux libres pour la durée par défaut (30 min)", () => {
    monter();
    expect(screen.getByRole("button", { name: "30 min" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Planifier de 16:10 à 16:40" })).toBeTruthy();
  });

  it("reprend la durée estimée de la tâche", () => {
    monter(makeTache({ id: "t1", titre: "Ranger", duree_minutes: 60 }));
    expect(screen.getByRole("button", { name: "1 h" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Planifier de 16:10 à 17:10" })).toBeTruthy();
  });

  it("recalcule les créneaux quand la durée change", async () => {
    monter(makeTache({ id: "t1", titre: "Ranger le bureau" }), [
      { debut: "16:10", fin: "17:00" },
      { debut: "20:00", fin: "22:00" },
    ]);
    expect(screen.getByRole("button", { name: "Planifier de 16:10 à 16:40" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "2 h" }));
    // Seul le trou du soir (20:00 – 22:00) contient 2 h.
    expect(screen.queryByRole("button", { name: /Planifier de 16:10/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Planifier de 20:00 à 22:00" })).toBeTruthy();
  });

  it("explique quand aucun trou n'est assez long", () => {
    monter(makeTache({ id: "t1", titre: "Ranger" }), [{ debut: "10:00", fin: "10:20" }]);
    expect(screen.getByText(/Aucun trou libre de 30 min/)).toBeTruthy();
  });

  it("planifie au tap, enregistre la durée absente, puis « Annuler » rétablit l'état d'avant", async () => {
    vi.mocked(planifierTache).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(restaurerPlanification).mockResolvedValue({ ok: true, data: undefined });
    const { onClose } = monter();

    await userEvent.click(screen.getByRole("button", { name: "Planifier de 16:10 à 16:40" }));

    await waitFor(() => expect(planifierTache).toHaveBeenCalledWith("t1", "2026-10-04", "16:10", 30, true));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const toast = getToasts().find((t) => t.text.includes("« Ranger le bureau » planifiée à 16:10"))!;
    toast.action!.onAction();
    await waitFor(() =>
      expect(restaurerPlanification).toHaveBeenCalledWith("t1", {
        echeance: null,
        heure: null,
        heure_fin: null,
        toute_la_journee: false,
        duree_minutes: null,
      })
    );
  });

  it("ne remplace pas une durée estimée déjà saisie", async () => {
    vi.mocked(planifierTache).mockResolvedValue({ ok: true, data: undefined });
    monter(makeTache({ id: "t1", titre: "Ranger", duree_minutes: 45 }));

    await userEvent.click(screen.getByRole("button", { name: "Planifier de 16:10 à 16:55" }));

    await waitFor(() => expect(planifierTache).toHaveBeenCalledWith("t1", "2026-10-04", "16:10", 45, false));
  });
});
