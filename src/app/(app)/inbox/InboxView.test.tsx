import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InboxView } from "./InboxView";
import { queryKeys } from "@/lib/query/keys";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/inbox",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/inbox", () => ({
  getInboxItems: vi.fn().mockResolvedValue([]),
  addInboxItem: vi.fn(),
  deleteInboxItem: vi.fn(),
  inboxVersTache: vi.fn(),
  inboxVersNote: vi.fn(),
}));
vi.mock("@/app/actions/evenements", () => ({ createEvenement: vi.fn(), updateEvenement: vi.fn() }));

import { inboxVersNote, inboxVersTache } from "@/app/actions/inbox";

afterEach(() => cleanup());

const ITEMS = [
  { id: "i1", texte: "Appeler le garage\nPour le pare-brise", created_at: new Date().toISOString() },
  { id: "i2", texte: "Idée cadeau", created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() },
];

function monter(items = ITEMS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(queryKeys.inbox, items);
  render(
    <QueryClientProvider client={client}>
      <InboxView today="2026-10-09" />
    </QueryClientProvider>
  );
}

describe("InboxView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("liste les captures avec leur titre, le reste et leur âge", () => {
    monter();
    expect(screen.getByText("2 éléments à trier")).toBeTruthy();
    expect(screen.getByText("Appeler le garage")).toBeTruthy();
    expect(screen.getByText("Pour le pare-brise")).toBeTruthy();
    expect(screen.getByText("il y a 3 j")).toBeTruthy();
  });

  it("inbox vide : message d'accueil", () => {
    monter([]);
    expect(screen.getByText("Inbox vide")).toBeTruthy();
    expect(screen.getByText(/Rien à trier/)).toBeTruthy();
  });

  it("« Tâche » convertit la capture", async () => {
    vi.mocked(inboxVersTache).mockResolvedValue({ ok: true, data: { id: "t1" } });
    monter();
    const groupe = screen.getByRole("group", { name: "Trier « Appeler le garage »" });
    await userEvent.click(groupe.querySelector("button")!);
    await waitFor(() => expect(inboxVersTache).toHaveBeenCalledWith("i1"));
  });

  it("« Note » convertit la capture", async () => {
    vi.mocked(inboxVersNote).mockResolvedValue({ ok: true, data: { id: "n1" } });
    monter();
    const groupe = screen.getByRole("group", { name: "Trier « Idée cadeau »" });
    await userEvent.click(Array.from(groupe.querySelectorAll("button")).find((b) => b.textContent === "Note")!);
    await waitFor(() => expect(inboxVersNote).toHaveBeenCalledWith("i2"));
  });

  it("« Événement » ouvre le formulaire pré-rempli avec le titre", async () => {
    monter();
    const groupe = screen.getByRole("group", { name: "Trier « Idée cadeau »" });
    await userEvent.click(Array.from(groupe.querySelectorAll("button")).find((b) => b.textContent === "Événement")!);
    expect((await screen.findByLabelText("Titre") as HTMLInputElement).value).toBe("Idée cadeau");
  });

  it("« Supprimer » masque la capture tout de suite et propose d'annuler", async () => {
    monter();
    await userEvent.click(screen.getByRole("button", { name: "Supprimer « Idée cadeau »" }));
    expect(screen.queryByText("Idée cadeau")).toBeNull();
    expect(screen.getByText("1 élément à trier")).toBeTruthy();
  });
});
