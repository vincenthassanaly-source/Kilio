import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";
import type { Tables } from "@/lib/supabase/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/actions/recettes", () => ({ deleteRecette: vi.fn() }));
vi.mock("../RecetteForm", () => ({ RecetteForm: () => null }));
vi.mock("@/components/BackLink", () => ({ BackLink: () => null }));

import { deleteRecette } from "@/app/actions/recettes";
import { RecetteHeader } from "./RecetteHeader";

const RECETTE = {
  id: "rec-1",
  nom: "Curry",
  source: "manuel",
  temps_prepa_min: 20,
  portions: 2,
  description: null,
} as unknown as Tables<"recettes">;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(deleteRecette).mockResolvedValue(undefined);
  render(<RecetteHeader recette={RECETTE} />);
  fireEvent.click(screen.getByRole("button", { name: "Supprimer la recette « Curry »" }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("recette", "rec-1");
  vi.clearAllMocks();
});

describe("RecetteHeader : suppression avec annulation différée", () => {
  it("renvoie à la liste tout de suite, sans confirmation ni appel serveur", () => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/nutrition/recettes");
    expect(deleteRecette).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Recette « Curry » supprimée");
  });

  it("« Annuler » n'appelle jamais le serveur", async () => {
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(deleteRecette).not.toHaveBeenCalled();
  });

  it("supprime la recette après le délai", async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(deleteRecette).toHaveBeenCalledWith("rec-1");
  });
});
