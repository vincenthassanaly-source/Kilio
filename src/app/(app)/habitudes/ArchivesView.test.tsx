import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArchivesView } from "./ArchivesView";

vi.mock("@/app/actions/habitudes", () => ({ getHabitudesArchivees: vi.fn(), desarchiverHabitude: vi.fn() }));

import { desarchiverHabitude, getHabitudesArchivees } from "@/app/actions/habitudes";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function rendre() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ArchivesView />
    </QueryClientProvider>
  );
}

const archivee = (id: string, nom: string, archivee_le: string | null) =>
  ({ id, nom, archivee_le, actif: false }) as never;

describe("ArchivesView", () => {
  it("liste les habitudes archivées avec leur date d'archivage", async () => {
    vi.mocked(getHabitudesArchivees).mockResolvedValue([
      archivee("h1", "Lecture", "2026-11-05"),
      archivee("h2", "Méditation", null),
    ]);
    rendre();

    expect(await screen.findByText("Lecture")).toBeTruthy();
    expect(screen.getByText("Archivée le 5 novembre 2026")).toBeTruthy();
    expect(screen.getByText("Méditation")).toBeTruthy();
    expect(screen.getByText("Archivée")).toBeTruthy();
    expect(screen.getByText(/son historique est conservé/)).toBeTruthy();
  });

  it("dit qu'il n'y a rien d'archivé quand la liste est vide", async () => {
    vi.mocked(getHabitudesArchivees).mockResolvedValue([]);
    rendre();

    expect(await screen.findByText("Aucune habitude archivée.")).toBeTruthy();
  });

  it("signale une erreur de chargement avec un moyen de réessayer", async () => {
    vi.mocked(getHabitudesArchivees).mockRejectedValue(new Error("ko"));
    rendre();

    expect(await screen.findByText("Impossible de charger les archives.")).toBeTruthy();
  });

  it("« Désarchiver » remet l'habitude active puis relit les archives", async () => {
    vi.mocked(getHabitudesArchivees).mockResolvedValue([archivee("h1", "Lecture", "2026-11-05")]);
    vi.mocked(desarchiverHabitude).mockResolvedValue({ ok: true, data: undefined });
    rendre();

    fireEvent.click(await screen.findByRole("button", { name: "Désarchiver" }));

    await waitFor(() => expect(desarchiverHabitude).toHaveBeenCalledWith("h1"));
    await waitFor(() => expect(getHabitudesArchivees).toHaveBeenCalledTimes(2));
  });
});
