import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NoteForm } from "./NoteForm";

afterEach(cleanup);

vi.mock("@/app/actions/notes", () => ({
  toggleNoteItem: vi.fn(),
  addNoteItem: vi.fn(),
  deleteNoteItem: vi.fn(),
  reorderNoteItems: vi.fn(),
  updateNote: vi.fn(),
  updateNoteItemLibelle: vi.fn(),
  createNote: vi.fn(),
}));

function rendreChecklist() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NoteForm
        tags={[]}
        initial={{ titre: "Courses", type: "checklist", contenu: "", items: ["Pain", "Lait"], tagIds: [], nouveauxTags: [] }}
      />
    </QueryClientProvider>,
  );
}

const itemsEnvoyes = (conteneur: HTMLElement) =>
  Array.from(conteneur.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="item_libelle"]')).map((i) => i.value);

// Constat I1 de l'audit design du 2026-11-12 : un item tapé sans appuyer sur
// « Ajouter » disparaissait en silence à la création de la note.
describe("NoteForm : checklist en création", () => {
  it("envoie les items déjà ajoutés", () => {
    const { container } = rendreChecklist();
    expect(itemsEnvoyes(container)).toEqual(["Pain", "Lait"]);
  });

  it("envoie aussi l'item tapé mais pas encore ajouté", async () => {
    const user = userEvent.setup();
    const { container } = rendreChecklist();

    await user.type(screen.getByLabelText("Ajouter un item"), "Beurre");

    expect(itemsEnvoyes(container)).toEqual(["Pain", "Lait", "Beurre"]);
  });

  it("n'envoie rien en plus quand le champ est vide ou ne contient que des espaces", async () => {
    const user = userEvent.setup();
    const { container } = rendreChecklist();

    await user.type(screen.getByLabelText("Ajouter un item"), "   ");

    expect(itemsEnvoyes(container)).toEqual(["Pain", "Lait"]);
  });

  it("n'envoie pas l'item deux fois une fois ajouté avec « Ajouter »", async () => {
    const user = userEvent.setup();
    const { container } = rendreChecklist();

    await user.type(screen.getByLabelText("Ajouter un item"), "Beurre");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(itemsEnvoyes(container)).toEqual(["Pain", "Lait", "Beurre"]);
  });
});
