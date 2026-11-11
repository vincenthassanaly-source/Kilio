import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TasksList } from "./TasksList";
import { queryKeys } from "@/lib/query/keys";
import { makeTache } from "@/test/fixtures";

vi.mock("@/app/actions/taches", () => ({
  createSousTache: vi.fn(),
  deleteSousTache: vi.fn(),
  deleteTache: vi.fn(),
  enregistrerOrdreTaches: vi.fn(),
  reordonnerSousTaches: vi.fn(),
  toggleSousTache: vi.fn(),
  setTacheFait: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function monter(onEnterSelect?: (id: string) => void) {
  const tache = makeTache({ id: "t1", titre: "Payer le loyer" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(queryKeys.taches, [tache]);
  render(
    <QueryClientProvider client={client}>
      <TasksList taches={[tache]} listes={[]} tags={[]} onEnterSelect={onEnterSelect} />
    </QueryClientProvider>
  );
  return screen.getByRole("button", { name: /Payer le loyer.*\(modifier\)/ });
}

describe("TaskCard : entrer en sélection (appui long)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("un appui long tactile entre en sélection et n'ouvre pas l'édition", () => {
    const onEnterSelect = vi.fn();
    const titre = monter(onEnterSelect);

    fireEvent.pointerDown(titre, { pointerType: "touch", isPrimary: true, clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onEnterSelect).toHaveBeenCalledWith("t1");

    // Le clic qui suit le relâchement est avalé : pas de formulaire d'édition.
    fireEvent.pointerUp(titre, { pointerType: "touch" });
    fireEvent.click(titre);
    expect(screen.queryByText("Annuler")).toBeNull();
  });

  it("un appui bref ou un défilement n'entre pas en sélection", () => {
    const onEnterSelect = vi.fn();
    const titre = monter(onEnterSelect);

    fireEvent.pointerDown(titre, { pointerType: "touch", isPrimary: true, clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.pointerUp(titre, { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    fireEvent.pointerDown(titre, { pointerType: "touch", isPrimary: true, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(titre, { pointerType: "touch", clientX: 10, clientY: 60 });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onEnterSelect).not.toHaveBeenCalled();
  });

  it("la souris n'a pas d'appui long : le bouton « Sélectionner » de la carte sert de repli", () => {
    const onEnterSelect = vi.fn();
    const titre = monter(onEnterSelect);

    fireEvent.pointerDown(titre, { pointerType: "mouse", isPrimary: true });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onEnterSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Sélectionner « Payer le loyer »/ }));
    expect(onEnterSelect).toHaveBeenCalledWith("t1");
  });

  it("sans onEnterSelect (Agenda), aucun geste ni bouton de sélection", () => {
    monter(undefined);
    expect(screen.queryByRole("button", { name: /Sélectionner «/ })).toBeNull();
  });
});
