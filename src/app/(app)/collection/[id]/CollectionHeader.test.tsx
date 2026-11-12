import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CollectionHeader } from "./CollectionHeader";
import { renameCollection } from "@/app/actions/collections";
import type { Tables } from "@/lib/supabase/types";
import type { ComponentProps } from "react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/components/TransitionLink", () => ({
  TransitionLink: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

vi.mock("@/app/actions/collections", () => ({
  renameCollection: vi.fn(),
  deleteCollection: vi.fn(),
}));

function makeCollection(overrides: Partial<Tables<"collections">> = {}): Tables<"collections"> {
  return {
    id: "col-1",
    nom: "Vacances",
    ordre: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// CLICK-PATH-604 : le bouton/geste retour ferme le formulaire de renommage
// ouvert au lieu de faire quitter la page (navigation involontaire, saisie
// perdue silencieusement).
describe("CollectionHeader - useBackClose ferme le renommage sans quitter la page (CLICK-PATH-604)", () => {
  it("le retour navigateur ferme le formulaire de renommage plutôt que de naviguer hors de la page", async () => {
    const user = userEvent.setup();
    const client = new QueryClient();
    const collection = makeCollection();

    render(
      <QueryClientProvider client={client}>
        <CollectionHeader collection={collection} />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole("button", { name: "Renommer" }));
    expect(screen.getByDisplayValue("Vacances")).toBeInTheDocument();

    // Simule un appui sur le bouton retour matériel/navigateur : useBackClose
    // a poussé une entrée d'historique à l'ouverture du formulaire, la
    // quitter déclenche son onBack (fermeture) plutôt qu'une navigation.
    window.history.back();

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Vacances")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Renommer" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

function rendre() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CollectionHeader collection={makeCollection()} />
    </QueryClientProvider>
  );
}

describe("CollectionHeader - renommage et suppression", () => {
  it("affiche un message lisible (pas l'exception brute) quand le renommage échoue", async () => {
    vi.mocked(renameCollection).mockRejectedValueOnce(new Error("An error occurred in the Server Components render."));
    const user = userEvent.setup();
    rendre();

    await user.click(screen.getByRole("button", { name: "Renommer" }));
    await user.type(screen.getByLabelText("Nom de la collection"), " 2");
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(await screen.findByText("Le renommage a échoué. Réessaie.")).toBeInTheDocument();
    expect(screen.queryByText(/Server Components/)).not.toBeInTheDocument();
  });

  it("repart du nom actuel quand on rouvre le renommage", async () => {
    const user = userEvent.setup();
    rendre();

    await user.click(screen.getByRole("button", { name: "Renommer" }));
    await user.type(screen.getByLabelText("Nom de la collection"), " brouillon");
    window.history.back();
    await waitFor(() => expect(screen.queryByLabelText("Nom de la collection")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Renommer" }));
    expect(screen.getByLabelText("Nom de la collection")).toHaveValue("Vacances");
  });

  it("le bouton de suppression a un nom accessible complet", () => {
    rendre();
    expect(screen.getByRole("button", { name: "Supprimer la collection" })).toHaveTextContent("Supprimer");
  });
});
