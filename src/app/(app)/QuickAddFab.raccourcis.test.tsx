import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuickAddFab } from "./QuickAddFab";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/actions/taches", () => ({
  getListes: vi.fn(async () => [{ id: "liste-1", nom: "Perso" }]),
  getTags: vi.fn(async () => []),
}));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Formulaire() {
      return <div data-testid="formulaire-tache" />;
    },
}));
vi.mock("./aujourdhui/EvenementForm", () => ({
  EvenementForm: () => <div data-testid="formulaire-evenement" />,
}));
vi.mock("./courses/AddCourseForm", () => ({ AddCourseForm: () => null }));
vi.mock("./nutrition/journal/AjoutRepasBouton", () => ({ useAjoutRepasTermine: () => false }));

afterEach(async () => {
  cleanup();
  // Le démontage appelle history.back() (useBackClose), asynchrone dans jsdom :
  // on attend qu'il soit passé avant de réinitialiser l'URL.
  await new Promise((r) => setTimeout(r, 20));
  window.history.replaceState(null, "", "/");
});

function monter(props: Parameters<typeof QuickAddFab>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <QuickAddFab {...props} />
    </QueryClientProvider>
  );
}

describe("QuickAddFab — raccourcis d'appui long", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("?action=new ouvre le formulaire de tâche en mode direct et nettoie l'URL", async () => {
    window.history.replaceState(null, "", "/taches?action=new&liste=abc");
    monter({ directTask: {} });

    await waitFor(() => expect(screen.getByTestId("formulaire-tache")).toBeTruthy());
    expect(window.location.search).toBe("?liste=abc");
  });

  it("?ajout=evenement ouvre le formulaire d'événement et nettoie l'URL", async () => {
    window.history.replaceState(null, "", "/?ajout=evenement");
    monter();

    await waitFor(() => expect(screen.getByTestId("formulaire-evenement")).toBeTruthy());
    expect(window.location.search).toBe("");
  });

  it("sans paramètre, aucun formulaire ne s'ouvre", async () => {
    window.history.replaceState(null, "", "/");
    monter();

    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("formulaire-tache")).toBeNull();
    expect(screen.queryByTestId("formulaire-evenement")).toBeNull();
  });
});
