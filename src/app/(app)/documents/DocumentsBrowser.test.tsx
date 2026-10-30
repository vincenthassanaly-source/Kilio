import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Les composants lourds (formulaire, cartes, modal de tri) sont remplacés : on teste
// ici le filtrage par catégorie et le tri de la page Documents, pas leur rendu.
vi.mock("./AddDocumentToggle", () => ({ AddDocumentToggle: () => null }));
vi.mock("./TriVracModal", () => ({ TriVracModal: () => null }));
vi.mock("./ReorganiserModal", () => ({
  ReorganiserModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Réorganiser les documents">
      <button type="button" onClick={onClose}>
        Fermer la fenêtre
      </button>
    </div>
  ),
}));
vi.mock("./DocumentsList", () => ({
  DocumentsList: ({ documents }: { documents: { id: string; nom: string }[] }) => (
    <ul data-testid="liste">
      {documents.map((d) => (
        <li key={d.id}>{d.nom}</li>
      ))}
    </ul>
  ),
}));

import { DocumentsBrowser } from "./DocumentsBrowser";

const CATEGORIES = ["Identité", "Logement", "Santé", "Travail"];

function document(id: string, nom: string, categorie: string | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    nom,
    categorie,
    notes: null,
    en_vrac: false,
    created_at: `2026-10-${id.padStart(2, "0")}T10:00:00Z`,
    updated_at: "2026-10-29T10:00:00Z",
    fichiers: [],
    ...extra,
  } as never;
}

const DOCUMENTS = [
  document("1", "Carte d'identité", "Identité"),
  document("2", "Facture EDF", "Logement"),
  document("3", "Bail", "Logement"),
  document("4", "Sans catégorie", null),
  document("5", "Reçu au vrac", "Santé", { en_vrac: true }),
];

function noms() {
  return within(screen.getByTestId("liste"))
    .getAllByRole("listitem")
    .map((li) => li.textContent);
}

afterEach(cleanup);

describe("DocumentsBrowser : catégories", () => {
  it("propose une pastille par catégorie qui a des documents classés, avec leur nombre", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);

    const groupe = screen.getByRole("group", { name: "Filtrer par catégorie" });
    expect(within(groupe).getByRole("button", { name: /Identité/ })).toHaveTextContent("Identité 1");
    expect(within(groupe).getByRole("button", { name: /Logement/ })).toHaveTextContent("Logement 2");
    // Ni une catégorie vide (« Travail »), ni celle d'un document encore en vrac (« Santé »).
    expect(within(groupe).queryByRole("button", { name: /Travail/ })).toBeNull();
    expect(within(groupe).queryByRole("button", { name: /Santé/ })).toBeNull();
  });

  it("n'affiche plus d'étiquettes ni de tri par échéance", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);

    expect(screen.queryByText(/étiquette/i)).toBeNull();
    const tri = screen.getByRole("combobox", { name: "Trier les documents" });
    expect(within(tri).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Récent",
      "Nom A→Z",
      "Catégorie A→Z",
    ]);
    expect(tri).toHaveValue("recent");
  });

  it("filtre la liste au toucher d'une pastille, avec coche et état pressé, et se retire au second toucher", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);
    expect(noms().sort()).toEqual(["Bail", "Carte d'identité", "Facture EDF", "Sans catégorie"]);

    const logement = screen.getByRole("button", { name: /Logement/ });
    expect(logement).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(logement);
    expect(noms().sort()).toEqual(["Bail", "Facture EDF"]);
    expect(logement).toHaveAttribute("aria-pressed", "true");
    // L'état ne tient pas qu'à la couleur : une coche s'ajoute.
    expect(logement).toHaveTextContent("✓");

    fireEvent.click(logement);
    expect(noms()).toHaveLength(4);
    expect(logement).toHaveAttribute("aria-pressed", "false");
  });

  it("cumule plusieurs catégories", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole("button", { name: /Logement/ }));
    fireEvent.click(screen.getByRole("button", { name: /Identité/ }));

    expect(noms().sort()).toEqual(["Bail", "Carte d'identité", "Facture EDF"]);
  });

  it("présélectionne la catégorie ouverte depuis l'écran Catégories (?categorie=)", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} categoriesInitiales={["Logement"]} />);

    expect(noms().sort()).toEqual(["Bail", "Facture EDF"]);
    expect(screen.getByRole("button", { name: /Logement/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("garde visible une catégorie présélectionnée sans document, avec un message clair", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} categoriesInitiales={["Travail"]} />);

    expect(screen.getByRole("button", { name: /Travail/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Aucun document dans cette catégorie.")).toBeInTheDocument();
  });

  it("fait passer les pastilles à la ligne au lieu de les couper dans une rangée qui défile", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);

    const classes = screen.getByRole("group", { name: "Filtrer par catégorie" }).className;
    expect(classes).toContain("flex-wrap");
    expect(classes).not.toContain("overflow-x-auto");
  });

  it("garde le lien vers la gestion des catégories", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);

    expect(screen.getByRole("link", { name: "Gérer les catégories" })).toHaveAttribute("href", "/documents/categories");
  });

  it("trie par catégorie A→Z, les documents sans catégorie en dernier", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Trier les documents" }), { target: { value: "categorie" } });

    expect(noms()).toEqual(["Carte d'identité", "Bail", "Facture EDF", "Sans catégorie"]);
  });

  it("les documents en vrac n'apparaissent pas dans la liste principale", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);

    expect(noms()).not.toContain("Reçu au vrac");
    expect(screen.getByRole("button", { name: "Vrac, 1 à trier" })).toBeInTheDocument();
  });
});

describe("DocumentsBrowser : réorganiser", () => {
  it("ouvre la fenêtre de réorganisation et la referme", async () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Réorganiser" }));
    // Chargée à la demande (next/dynamic) : elle apparaît un instant après le toucher.
    expect(await screen.findByRole("dialog", { name: "Réorganiser les documents" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fermer la fenêtre" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("reste disponible depuis l'onglet Vrac", () => {
    render(<DocumentsBrowser documents={DOCUMENTS} categories={CATEGORIES} vracInitial />);

    expect(screen.getByRole("button", { name: "Réorganiser" })).toBeInTheDocument();
  });

  it("n'apparaît pas tant qu'il y a moins de deux documents classés", () => {
    render(
      <DocumentsBrowser
        documents={[document("1", "Carte d'identité", "Identité"), document("5", "Reçu au vrac", null, { en_vrac: true })]}
        categories={CATEGORIES}
      />
    );

    expect(screen.queryByRole("button", { name: "Réorganiser" })).toBeNull();
  });
});
