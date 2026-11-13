import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";

vi.mock("@/app/actions/documents-categories", () => ({
  creerCategorie: vi.fn(),
  fusionnerCategories: vi.fn(),
  renommerCategorie: vi.fn(),
  supprimerCategorie: vi.fn(),
}));

import { supprimerCategorie } from "@/app/actions/documents-categories";
import { CategoriesManager } from "./CategoriesManager";

const CATEGORIES = [
  { id: "c1", nom: "Banque", nb: 3 },
  { id: "c2", nom: "Santé", nb: 0 },
] as never;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(supprimerCategorie).mockResolvedValue({ ok: true, data: undefined } as never);
  render(<CategoriesManager categories={CATEGORIES} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" })[0]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("categorie-document", "c1");
  vi.clearAllMocks();
});

describe("CategoriesManager : suppression avec annulation différée", () => {
  it("retire la ligne tout de suite, sans boîte de confirmation ni appel serveur, et annonce les documents touchés", () => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Banque")).not.toBeInTheDocument();
    expect(screen.getByText("Santé")).toBeInTheDocument();
    expect(supprimerCategorie).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Catégorie « Banque » supprimée · 3 documents sans catégorie");
  });

  it("« Annuler » remet la ligne sans appel serveur", async () => {
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getByText("Banque")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(supprimerCategorie).not.toHaveBeenCalled();
  });

  it("supprime la catégorie après le délai", async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(supprimerCategorie).toHaveBeenCalledWith("c1");
  });
});
