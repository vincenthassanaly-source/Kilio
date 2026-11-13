import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";
import type { IdeeAvecVersions } from "@/app/actions/opinions";

const navigate = vi.fn();
vi.mock("@/hooks/useViewTransitionNavigate", () => ({ useViewTransitionNavigate: () => navigate }));
vi.mock("@/app/actions/opinions", () => ({
  changerStatutIdee: vi.fn(),
  modifierIdee: vi.fn(),
  supprimerIdee: vi.fn(),
}));
vi.mock("@/components/BackLink", () => ({ BackLink: () => null }));

import { supprimerIdee } from "@/app/actions/opinions";
import { IdeeEditor } from "./IdeeEditor";

const IDEE = {
  id: "idee-1",
  statut: "brouillon",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  position: "Il faut plus de transports en commun",
  theme: null,
  conviction: "moyenne",
  arguments_pour: "",
  arguments_contre: "",
  source: "",
  scores: { economie: null, social: null, ecologie: null, europe: null, securite: null, institutions: null },
  versions: [],
  origine: null,
} as unknown as IdeeAvecVersions;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(supprimerIdee).mockResolvedValue({ ok: true, data: undefined });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IdeeEditor idee={IDEE} />
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "Supprimer l'idée" }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("idee", "idee-1");
  vi.clearAllMocks();
});

describe("IdeeEditor : suppression avec annulation différée", () => {
  it("renvoie à la liste tout de suite, sans boîte de confirmation ni appel serveur", () => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith("/opinions");
    expect(supprimerIdee).not.toHaveBeenCalled();
    const toast = getToasts().find((t) => t.action);
    expect(toast?.text).toBe("Idée « Il faut plus de transports en commun » supprimée");
    expect(toast?.action?.label).toBe("Annuler");
  });

  it("« Annuler » n'appelle jamais le serveur", async () => {
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(supprimerIdee).not.toHaveBeenCalled();
  });

  it("supprime l'idée après le délai", async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(supprimerIdee).toHaveBeenCalledWith("idee-1");
  });
});
