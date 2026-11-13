import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuickAddFab } from "./QuickAddFab";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// Formulaires chargés à la demande : hors sujet ici, on vérifie l'éventail.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/app/actions/taches", () => ({ getListes: vi.fn(async () => []), getTags: vi.fn(async () => []) }));
vi.mock("./taches/preloadAddTaskForm", () => ({ preloadAddTaskForm: vi.fn() }));
vi.mock("./courses/AddCourseForm", () => ({ AddCourseForm: () => <p>formulaire courses</p> }));
vi.mock("./_accueil/EvenementForm", () => ({ EvenementForm: () => <p>formulaire événement</p> }));
vi.mock("./nutrition/journal/AjoutRepasBouton", () => ({ useAjoutRepasTermine: () => vi.fn() }));

afterEach(() => {
  cleanup();
});

function monter() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <QuickAddFab />
    </QueryClientProvider>
  );
}

describe("QuickAddFab", () => {
  it("propose toutes les portes de création d'Aujourd'hui : repas, courses, tâche, événement, note", async () => {
    monter();
    await userEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    for (const nom of ["Ajouter un repas", "Courses", "Ajouter une tâche", "Ajouter un événement", "Ajouter une note"]) {
      expect(screen.getByRole("button", { name: nom })).toBeVisible();
    }
  });

  it("ouvre le formulaire d'événement depuis l'éventail", async () => {
    monter();
    await userEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter un événement" }));

    expect(await screen.findByText("formulaire événement")).toBeInTheDocument();
  });
});
