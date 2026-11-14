import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NoteCard } from "./NoteCard";
import { queryKeys } from "@/lib/query/keys";
import { makeNote } from "@/test/fixtures";
import type { NoteAvecRelations } from "@/app/actions/notes";

afterEach(cleanup);

vi.mock("@/app/actions/notes", () => ({
  toggleEpingle: vi.fn(),
  toggleNoteItem: vi.fn(),
  deleteNote: vi.fn(),
}));

import { toggleEpingle, toggleNoteItem } from "@/app/actions/notes";

function renderWithClient(client: QueryClient, note: NoteAvecRelations) {
  return render(
    <QueryClientProvider client={client}>
      <NoteCard note={note} tags={[]} />
    </QueryClientProvider>
  );
}

// CLICK-PATH-603 : le rollback d'une mutation optimiste ne doit toucher que
// le champ qu'elle a elle-même modifié, pas tout le tableau `queryKeys.notes`
// — sinon il écrase une mutation sœur indépendante déjà appliquée au cache
// entre-temps (ex. un item coché sur une autre note pendant qu'une épingle
// échoue sur celle-ci).
describe("NoteCard - rollback scopé des mutations optimistes (CLICK-PATH-603)", () => {
  it("pinMutation : un rollback sur l'épingle ne réécrase pas un item déjà coché ailleurs dans le cache", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const noteA = makeNote({ id: "note-a", epingle: false });
    const noteB = makeNote({
      id: "note-b",
      items: [{ id: "item-b1", note_id: "note-b", libelle: "Lait", coche: false, position: 0, created_at: "", updated_at: "", termine_le: null }],
    });
    client.setQueryData(queryKeys.notes, [noteA, noteB]);

    vi.mocked(toggleEpingle).mockRejectedValue(new Error("boom"));

    renderWithClient(client, noteA);

    await user.click(screen.getByRole("button", { name: /Épingler la note/ }));

    // Pendant que la mutation d'épingle de note-a est en vol, une mutation
    // indépendante sur note-b (coche d'un item) écrit dans le même cache.
    client.setQueryData<NoteAvecRelations[]>(queryKeys.notes, (old) =>
      old?.map((n) => (n.id === "note-b" ? { ...n, items: n.items.map((i) => ({ ...i, coche: true })) } : n))
    );

    await waitFor(() => {
      const notes = client.getQueryData<NoteAvecRelations[]>(queryKeys.notes)!;
      expect(notes.find((n) => n.id === "note-a")!.epingle).toBe(false);
    });

    const notes = client.getQueryData<NoteAvecRelations[]>(queryKeys.notes)!;
    expect(notes.find((n) => n.id === "note-b")!.items[0].coche).toBe(true);
  });

  it("itemMutation : un rollback sur un item ne réécrase pas une épingle déjà changée ailleurs dans le cache", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const noteA = makeNote({
      id: "note-a",
      items: [{ id: "item-a1", note_id: "note-a", libelle: "Pain", coche: false, position: 0, created_at: "", updated_at: "", termine_le: null }],
    });
    const noteB = makeNote({ id: "note-b", epingle: false });
    client.setQueryData(queryKeys.notes, [noteA, noteB]);

    vi.mocked(toggleNoteItem).mockRejectedValue(new Error("boom"));

    renderWithClient(client, noteA);

    await user.click(screen.getByRole("button", { name: "Cocher « Pain »" }));

    // Mutation indépendante concurrente sur note-b pendant que l'item de
    // note-a échoue et doit être annulé.
    client.setQueryData<NoteAvecRelations[]>(queryKeys.notes, (old) =>
      old?.map((n) => (n.id === "note-b" ? { ...n, epingle: true } : n))
    );

    await waitFor(() => {
      const notes = client.getQueryData<NoteAvecRelations[]>(queryKeys.notes)!;
      expect(notes.find((n) => n.id === "note-a")!.items[0].coche).toBe(false);
    });

    const notes = client.getQueryData<NoteAvecRelations[]>(queryKeys.notes)!;
    expect(notes.find((n) => n.id === "note-b")!.epingle).toBe(true);
  });

  it("épingle : libellé fixe et état annoncé par aria-pressed", () => {
    const client = new QueryClient();
    renderWithClient(client, makeNote({ id: "note-p", epingle: true }));
    expect(screen.getByRole("button", { name: /Épingler la note/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("checklist : barre de progression annoncée et actions de la tuile nommées", () => {
    const client = new QueryClient();
    const item = { note_id: "note-c", created_at: "", updated_at: "", termine_le: null };
    renderWithClient(
      client,
      makeNote({
        id: "note-c",
        titre: "Courses",
        type: "checklist",
        items: [
          { ...item, id: "i1", libelle: "Pain", coche: true, position: 0 },
          { ...item, id: "i2", libelle: "Lait", coche: false, position: 1 },
        ],
      })
    );
    const barre = screen.getByRole("progressbar");
    expect(barre).toHaveAttribute("aria-valuenow", "1");
    expect(barre).toHaveAttribute("aria-valuetext", "1 sur 2");
    expect(screen.getByRole("button", { name: "Modifier la note « Courses »" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer la note « Courses »" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Décocher « Pain »" })).toBeInTheDocument();
  });
});
