import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";
import type { DocumentAvecFichiers } from "@/app/actions/documents";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/actions/documents", () => ({ deleteDocument: vi.fn() }));
vi.mock("../DocumentForm", () => ({ DocumentForm: () => null }));
vi.mock("../BoutonDescription", () => ({ BoutonDescription: () => null }));
vi.mock("../BoutonRemettreEnVrac", () => ({ BoutonRemettreEnVrac: () => null }));
vi.mock("@/components/BackLink", () => ({ BackLink: () => null }));

import { deleteDocument } from "@/app/actions/documents";
import { DocumentDetail } from "./DocumentDetail";

const DOCUMENT = {
  id: "doc-1",
  nom: "Facture EDF",
  categorie: null,
  notes: null,
  en_vrac: true,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  fichiers: [],
} as unknown as DocumentAvecFichiers;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(deleteDocument).mockResolvedValue(undefined);
  render(<DocumentDetail document={DOCUMENT} categories={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("document", "doc-1");
  vi.clearAllMocks();
});

describe("DocumentDetail : suppression avec annulation différée", () => {
  it("renvoie à la liste tout de suite, sans confirmation ni appel serveur", () => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/documents");
    expect(deleteDocument).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Document « Facture EDF » supprimé");
  });

  it("« Annuler » n'appelle jamais le serveur", async () => {
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("la suppression part après le délai, même si l'écran a été quitté", async () => {
    cleanup(); // écran démonté (navigation dans l'app) : le minuteur est au niveau du module
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(deleteDocument).toHaveBeenCalledWith("doc-1");
  });
});
