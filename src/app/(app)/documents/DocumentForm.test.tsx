import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Server Actions et rendu PDF (pdfjs) : inutiles pour tester les champs du formulaire.
vi.mock("@/app/actions/documents", () => ({
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocumentFichier: vi.fn(),
}));
vi.mock("@/lib/pdf/apercuPdf", () => ({ estPdf: vi.fn(), genererApercuPdf: vi.fn() }));

import { DocumentForm } from "./DocumentForm";

const CATEGORIES = ["Identité", "Logement", "Santé"];

function documentAvecFichiers(fichiers: Record<string, unknown>[]) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nom: "Carte d'identité",
    categorie: "Identité",
    notes: null,
    en_vrac: false,
    created_at: "2026-10-29T10:00:00Z",
    updated_at: "2026-10-29T10:00:00Z",
    fichiers,
  } as never;
}

const FICHIER_RECTO = {
  id: "f1",
  document_id: "11111111-1111-4111-8111-111111111111",
  url: "https://stockage.test/storage/v1/object/public/documents-fichiers/recto.jpg",
  fichier_type: "image",
  ordre: 0,
  role: "recto",
  apercu_url: null,
  created_at: "2026-10-29T10:00:00Z",
};

function champ(name: string) {
  return document.querySelector(`[name="${name}"]`);
}

afterEach(cleanup);

describe("DocumentForm", () => {
  it("garde le champ fichier requis focalisable (sr-only, pas display:none) pour que l'oubli soit signalé", () => {
    render(<DocumentForm categories={CATEGORIES} />);

    const fichiers = champ("fichiers") as HTMLInputElement;
    expect(fichiers).toBeRequired();
    expect(fichiers).toHaveClass("sr-only");
    expect(fichiers).not.toHaveClass("hidden");
  });

  it("n'a plus de champ étiquette, échéance ni mois concerné, et garde nom, catégorie et notes", () => {
    render(<DocumentForm categories={CATEGORIES} />);

    expect(screen.queryByLabelText(/étiquette/i)).toBeNull();
    expect(screen.queryByLabelText(/échéance/i)).toBeNull();
    expect(screen.queryByLabelText(/mois concerné/i)).toBeNull();
    expect(champ("etiquette_id")).toBeNull();
    expect(champ("date_echeance")).toBeNull();
    expect(champ("periode_mois")).toBeNull();

    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
    expect(screen.getByLabelText(/Catégorie/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
  });

  it("liste les catégories dans le menu", () => {
    render(<DocumentForm categories={CATEGORIES} />);

    const options = Array.from((screen.getByLabelText(/Catégorie/) as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(["—", "Identité", "Logement", "Santé"]);
  });

  it("propose « Document » par défaut : un sélecteur de plusieurs fichiers, pas de recto/verso", () => {
    render(<DocumentForm categories={CATEGORIES} />);

    expect(screen.getByRole("button", { name: "Document" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Recto / verso" })).toHaveAttribute("aria-pressed", "false");
    expect(champ("fichiers")).not.toBeNull();
    expect(champ("fichier_recto")).toBeNull();
    expect(champ("fichier_verso")).toBeNull();
  });

  it("passe en « Recto / verso » : deux emplacements dédiés à la place du sélecteur libre", () => {
    render(<DocumentForm categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole("button", { name: "Recto / verso" }));

    expect(screen.getByRole("button", { name: "Recto / verso" })).toHaveAttribute("aria-pressed", "true");
    expect(champ("fichier_recto")).not.toBeNull();
    expect(champ("fichier_verso")).not.toBeNull();
    expect(champ("fichiers")).toBeNull();
  });

  it("revient à « Document » et retrouve le sélecteur libre", () => {
    render(<DocumentForm categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole("button", { name: "Recto / verso" }));
    fireEvent.click(screen.getByRole("button", { name: "Document" }));

    expect(champ("fichiers")).not.toBeNull();
    expect(champ("fichier_recto")).toBeNull();
  });

  it("présélectionne « Recto / verso » quand le document a déjà un fichier recto", () => {
    render(<DocumentForm document={documentAvecFichiers([FICHIER_RECTO])} categories={CATEGORIES} />);

    expect(screen.getByRole("button", { name: "Recto / verso" })).toHaveAttribute("aria-pressed", "true");
    expect(champ("fichier_recto")).not.toBeNull();
  });

  it("garde « Document » pour un document sans recto/verso", () => {
    render(
      <DocumentForm
        document={documentAvecFichiers([{ ...FICHIER_RECTO, id: "f2", role: null }])}
        categories={CATEGORIES}
      />
    );

    expect(screen.getByRole("button", { name: "Document" })).toHaveAttribute("aria-pressed", "true");
    expect(champ("fichiers")).not.toBeNull();
  });

  describe("sélection de fichiers (prise de photo page par page)", () => {
    // jsdom n'a ni DataTransfer ni URL.createObjectURL : doublures minimales.
    class FauxDataTransfer {
      files: File[] = [];
      items = { add: (f: File) => void this.files.push(f) };
    }

    beforeEach(() => {
      vi.stubGlobal("DataTransfer", FauxDataTransfer);
      URL.createObjectURL = vi.fn(() => "blob:test");
      URL.revokeObjectURL = vi.fn();
    });
    afterEach(() => vi.unstubAllGlobals());

    const page = (nom: string) => new File(["x"], nom, { type: "image/jpeg" });
    const retraits = () => screen.queryAllByRole("button", { name: "Retirer ce fichier de la sélection" });
    const noms = (input: HTMLInputElement) => Array.from(input.files ?? []).map((f) => f.name);

    it("ajoute la page 2 à la page 1 au lieu de la remplacer", () => {
      render(<DocumentForm categories={CATEGORIES} />);
      const input = champ("fichiers") as HTMLInputElement;

      fireEvent.change(input, { target: { files: [page("page1.jpg")] } });
      fireEvent.change(input, { target: { files: [page("page2.jpg")] } });

      expect(retraits()).toHaveLength(2);
      // Ce qui est réellement envoyé (le FormData lit l'input) garde les deux pages, dans l'ordre.
      expect(noms(input)).toEqual(["page1.jpg", "page2.jpg"]);
    });

    it("garde la sélection quand le sélecteur de fichiers est annulé (change vide)", () => {
      render(<DocumentForm categories={CATEGORIES} />);
      const input = champ("fichiers") as HTMLInputElement;

      fireEvent.change(input, { target: { files: [page("page1.jpg")] } });
      // Chrome vide l'input quand on annule le sélecteur : l'état et l'input doivent rester alignés.
      fireEvent.change(input, { target: { files: [] } });

      expect(retraits()).toHaveLength(1);
      expect(noms(input)).toEqual(["page1.jpg"]);
    });
  });
});
