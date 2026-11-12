import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageBrouillon } from "@/lib/scanner/brouillon";
import { ExportPanel } from "./ExportPanel";

vi.mock("@/lib/scanner/traitement", () => ({
  jpegPourExport: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));
vi.mock("@/lib/scanner/pdf", () => ({
  PARAMS_QUALITE: { standard: { coteMax: 1600, jpeg: 0.8 }, elevee: { coteMax: 2400, jpeg: 0.88 } },
  genererPdf: vi.fn(async () => new Uint8Array(1024 * 1024)),
}));

function page(n: number): PageBrouillon {
  const b = new Blob([`p${n}`], { type: "image/jpeg" });
  return { id: `p${n}`, ordre: n, redresse: b, traite: b, filtre: "magic", largeur: 100, hauteur: 140, cree_le: "2026-11-06T10:00:00.000Z" };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExportPanel : fichier prêt", () => {
  it("invalide le fichier prêt quand les pages changent", async () => {
    const { rerender } = render(<ExportPanel pages={[page(1), page(2)]} onVider={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Créer le PDF/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Télécharger" })).toBeTruthy());

    // Une page est reprise : nouvel identifiant, le fichier généré est périmé.
    rerender(<ExportPanel pages={[page(1), page(3)]} onVider={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Télécharger" })).toBeNull();
    expect(screen.getByRole("button", { name: /Créer le PDF/ })).toBeTruthy();
  });

  it("garde le fichier prêt quand les pages sont identiques", async () => {
    const pages = [page(1)];
    const { rerender } = render(<ExportPanel pages={pages} onVider={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Créer le PDF/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Télécharger" })).toBeTruthy());
    rerender(<ExportPanel pages={[page(1)]} onVider={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Télécharger" })).toBeTruthy();
  });

  it("affiche le poids avec la virgule française", async () => {
    render(<ExportPanel pages={[page(1)]} onVider={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Créer le PDF/ }));
    await waitFor(() => expect(screen.getByText(/1,00 Mo/)).toBeTruthy());
  });
});
