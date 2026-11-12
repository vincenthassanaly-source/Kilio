import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { NoteForm } from "./NoteForm";
import { queryKeys } from "@/lib/query/keys";
import { makeNote } from "@/test/fixtures";
import type { NoteAvecRelations } from "@/app/actions/notes";

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

import { toggleNoteItem, updateNote, updateNoteItemLibelle } from "@/app/actions/notes";

// Harnais reproduisant le flux réel (NotesGrid -> useQuery(queryKeys.notes)
// -> NoteCard/NoteForm reçoivent `note` en prop) : sans lui, l'écriture
// optimiste dans le cache TanStack Query ne se refléterait dans aucun
// rendu, `note` étant ici passé en prop plutôt que lu depuis le cache par
// NoteForm lui-même.
function Harness() {
  const { data } = useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => Promise.resolve(client.getQueryData<NoteAvecRelations[]>(queryKeys.notes)!),
  });
  const note = data?.[0];
  if (!note) return null;
  return <NoteForm note={note} tags={[]} />;
}

let client: QueryClient;

// CLICK-PATH-602 : cocher un item dans l'éditeur de checklist (formulaire
// d'édition d'une note existante) doit être visuellement immédiat, sans
// attendre l'aller-retour serveur — avant le correctif, seule la tuile
// NoteCard bénéficiait de cette réactivité optimiste.
describe("NoteForm - éditeur de checklist : coche optimiste (CLICK-PATH-602)", () => {
  it("coche l'item immédiatement dans l'UI avant que la Server Action ne se résolve", async () => {
    const user = userEvent.setup();
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const note = makeNote({
      id: "note-1",
      items: [{ id: "item-1", note_id: "note-1", libelle: "Œufs", coche: false, position: 0, created_at: "", updated_at: "", termine_le: null }],
    });
    client.setQueryData(queryKeys.notes, [note]);

    // La Server Action ne se résout jamais pendant le test : si l'UI ne
    // change qu'après sa résolution, l'assertion ci-dessous échouera.
    vi.mocked(toggleNoteItem).mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );

    const toggle = screen.getByRole("button", { name: "Cocher « Œufs »" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Décocher « Œufs »" })).toHaveAttribute("aria-pressed", "true");
    });
  });
});

// Entrée dans le champ d'un libellé valide ce champ (blur) sans soumettre le formulaire.
describe("NoteForm - renommage d'item", () => {
  it("Entrée renomme l'item sans enregistrer ni fermer le formulaire", async () => {
    const user = userEvent.setup();
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const note = makeNote({
      id: "note-1",
      items: [{ id: "item-1", note_id: "note-1", libelle: "Œufs", coche: false, position: 0, created_at: "", updated_at: "", termine_le: null }],
    });
    client.setQueryData(queryKeys.notes, [note]);
    vi.mocked(updateNoteItemLibelle).mockResolvedValue(undefined as never);

    render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );

    const champ = screen.getByLabelText("Libellé de l'item « Œufs »");
    await user.clear(champ);
    await user.type(champ, "Œufs bio{Enter}");

    await waitFor(() => expect(updateNoteItemLibelle).toHaveBeenCalledWith("item-1", "Œufs bio"));
    expect(updateNote).not.toHaveBeenCalled();
  });

  it("pastilles de couleur : la sélection est annoncée par aria-pressed", () => {
    client = new QueryClient();
    client.setQueryData(queryKeys.notes, [makeNote({ id: "note-1", couleur: null })]);
    render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );
    expect(screen.getByRole("button", { name: "Aucune couleur" })).toHaveAttribute("aria-pressed", "true");
  });
});
