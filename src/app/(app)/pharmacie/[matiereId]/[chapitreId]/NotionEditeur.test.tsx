import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";
import type { PharmaNotion } from "@/lib/pharmacie/types";

vi.mock("@/app/actions/pharmacie", () => ({ modifierNotion: vi.fn(), supprimerNotion: vi.fn() }));
vi.mock("@/hooks/useBackClose", () => ({ useBackClose: vi.fn() }));
vi.mock("../../ContenuColore", () => ({ ContenuColore: () => null, IconeNiveau: () => null }));

import { supprimerNotion } from "@/app/actions/pharmacie";
import { NotionEditeur } from "./NotionEditeur";

const NOTION = { id: "n1", titre: "Anticoagulants", contenu: "AVK, AOD", tags: [] } as unknown as PharmaNotion;
const onClose = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(supprimerNotion).mockResolvedValue({ ok: true, data: undefined });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NotionEditeur notion={NOTION} nbCartes={3} onClose={onClose} />
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("pharma-notion", "n1");
  vi.clearAllMocks();
});

describe("NotionEditeur : suppression avec annulation différée", () => {
  it("ferme l'éditeur tout de suite, sans boîte de confirmation ni appel serveur, et annonce les cartes emportées", () => {
    expect(screen.queryByText("Supprimer cette notion ?")).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(supprimerNotion).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Notion « Anticoagulants » supprimée avec 3 cartes de révision");
  });

  it("« Annuler » n'appelle jamais le serveur", async () => {
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(supprimerNotion).not.toHaveBeenCalled();
  });

  it("supprime la notion après le délai", async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(supprimerNotion).toHaveBeenCalledWith("n1");
  });
});
