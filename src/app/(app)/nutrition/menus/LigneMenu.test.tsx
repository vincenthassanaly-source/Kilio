import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";

vi.mock("@/app/actions/menus", () => ({
  annulerValidationMenuEntry: vi.fn(),
  removeMenuEntry: vi.fn(),
  validerMenuEntry: vi.fn(),
}));

import { removeMenuEntry } from "@/app/actions/menus";
import { LigneMenu } from "./LigneMenu";

const REPAS = { id: "r1", label: "Curry de pois chiches", detail: "1 portion", kcal: 520, mange: false };

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(removeMenuEntry).mockResolvedValue({ ok: true, data: undefined });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ul>
        <LigneMenu repas={REPAS} />
      </ul>
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "Retirer « Curry de pois chiches » du menu" }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("menu-repas", "r1");
  vi.clearAllMocks();
});

describe("LigneMenu : retrait avec annulation différée", () => {
  it("retire la ligne tout de suite, sans boîte de confirmation ni appel serveur", () => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Curry de pois chiches")).not.toBeInTheDocument();
    expect(removeMenuEntry).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("« Curry de pois chiches » retiré du menu");
  });

  it("« Annuler » remet le repas sans appel serveur", async () => {
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getByText("Curry de pois chiches")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(removeMenuEntry).not.toHaveBeenCalled();
  });

  it("retire le repas du menu après le délai", async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(removeMenuEntry).toHaveBeenCalledWith("r1");
  });
});
