import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement, useMasques } from "@/lib/actions/elementsMasques";
import type { DocumentAvecFichiers } from "@/app/actions/documents";

vi.mock("@/app/actions/documents", () => ({
  deleteDocument: vi.fn(),
  enregistrerApercuPdf: vi.fn(),
}));
vi.mock("@/lib/pdf/apercuPdf", () => ({ genererApercuPdf: vi.fn() }));
vi.mock("@/components/TransitionLink", () => ({
  TransitionLink: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("./BoutonDescription", () => ({ BoutonDescription: () => null }));
vi.mock("./BoutonRemettreEnVrac", () => ({ BoutonRemettreEnVrac: () => null }));
vi.mock("./DocumentForm", () => ({ DocumentForm: () => null }));

import { deleteDocument } from "@/app/actions/documents";
import { DocumentCard } from "./DocumentCard";

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

// La carte reste affichée par la liste parente ; ici on observe l'état « masqué » du store.
function Observateur() {
  const masques = useMasques("document");
  return <p data-testid="masques">{[...masques].join(",")}</p>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(deleteDocument).mockResolvedValue(undefined);
  render(
    <>
      <ul>
        <DocumentCard document={DOCUMENT} categories={[]} />
      </ul>
      <Observateur />
    </>
  );
  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("document", "doc-1");
  vi.clearAllMocks();
});

describe("DocumentCard : suppression avec annulation différée", () => {
  it("masque le document tout de suite, sans boîte de confirmation ni appel serveur", () => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("masques")).toHaveTextContent("doc-1");
    expect(deleteDocument).not.toHaveBeenCalled();
    const toast = getToasts().find((t) => t.action);
    expect(toast?.text).toBe("Document « Facture EDF » supprimé");
    expect(toast?.action?.label).toBe("Annuler");
  });

  it("« Annuler » réaffiche le document sans appel serveur", async () => {
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getByTestId("masques")).toHaveTextContent("");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("supprime le document et ses fichiers après le délai", async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(deleteDocument).toHaveBeenCalledWith("doc-1");
  });
});
