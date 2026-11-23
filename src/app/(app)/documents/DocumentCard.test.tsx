import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocumentAvecFichiers } from "@/app/actions/documents";

vi.mock("@/app/actions/documents", () => ({ enregistrerApercuPdf: vi.fn() }));
vi.mock("@/lib/pdf/apercuPdf", () => ({ genererApercuPdf: vi.fn() }));
vi.mock("@/components/TransitionLink", () => ({
  TransitionLink: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { DocumentCard } from "./DocumentCard";

const DOCUMENT = {
  id: "doc-1",
  nom: "Facture EDF",
  categorie: "Logement",
  notes: null,
  en_vrac: false,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  fichiers: [],
} as unknown as DocumentAvecFichiers;

afterEach(cleanup);

describe("DocumentCard", () => {
  it("se réduit à un lien aperçu + nom vers la fiche", () => {
    render(
      <ul>
        <DocumentCard document={DOCUMENT} />
      </ul>
    );
    const lien = screen.getByRole("link");
    expect(lien).toHaveAttribute("href", "/documents/doc-1");
    expect(lien.textContent).toContain("Facture EDF");
    expect(lien.textContent).toContain("Logement");
  });

  it("n'expose plus d'action de gestion ni d'effet d'échelle au toucher", () => {
    render(
      <ul>
        <DocumentCard document={DOCUMENTS_SANS_RIEN} />
      </ul>
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link").className).not.toMatch(/active:scale/);
  });
});

const DOCUMENTS_SANS_RIEN = { ...DOCUMENT, categorie: null } as unknown as DocumentAvecFichiers;
