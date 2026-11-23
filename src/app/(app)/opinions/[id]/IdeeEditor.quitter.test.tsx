import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IdeeAvecVersions } from "@/app/actions/opinions";

const navigate = vi.fn();
vi.mock("@/hooks/useViewTransitionNavigate", () => ({ useViewTransitionNavigate: () => navigate }));
vi.mock("@/app/actions/opinions", () => ({
  changerStatutIdee: vi.fn(),
  modifierIdee: vi.fn(),
  supprimerIdee: vi.fn(),
}));
vi.mock("@/components/BackLink", () => ({
  BackLink: ({ children, onClick }: { children: ReactNode; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void }) => (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- simple double du BackLink en test
    <a href="/opinions" onClick={onClick}>
      {children}
    </a>
  ),
}));

import { IdeeEditor } from "./IdeeEditor";

const IDEE = {
  id: "idee-1",
  statut: "brouillon",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  position: "Il faut plus de transports en commun",
  theme: null,
  conviction: "plutot",
  arguments_pour: "",
  arguments_contre: "",
  source: "",
  scores: { economie: null, social: null, ecologie: null, europe: null, securite: null, institutions: null },
  versions: [],
  origine: null,
} as unknown as IdeeAvecVersions;

function rendre() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IdeeEditor idee={IDEE} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IdeeEditor : quitter et statut", () => {
  it("sans modification, le retour ramène directement à la liste", () => {
    rendre();
    fireEvent.click(screen.getByRole("link", { name: "Opinions" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith("/opinions", "recule");
  });

  it("avec une modification non enregistrée, demande « Quitter sans enregistrer ? »", () => {
    rendre();
    fireEvent.change(screen.getByLabelText("Position en une phrase"), { target: { value: "Autre position" } });
    fireEvent.click(screen.getByRole("link", { name: "Opinions" }));
    expect(navigate).not.toHaveBeenCalled();
    const dialogue = screen.getByRole("dialog");
    expect(within(dialogue).getByText("Quitter sans enregistrer ?")).toBeInTheDocument();
    fireEvent.click(within(dialogue).getByRole("button", { name: "Quitter sans enregistrer" }));
    expect(navigate).toHaveBeenCalledWith("/opinions", "recule");
  });

  it("l'erreur de validation sans thème s'affiche dans la section Statut", () => {
    rendre();
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent("Choisis un thème avant de valider cette idée.");
    expect(alerte.closest("section")).toHaveTextContent("Statut");
  });
});
