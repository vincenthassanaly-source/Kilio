import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TasksList } from "./TasksList";
import { queryKeys } from "@/lib/query/keys";
import { makeTache } from "@/test/fixtures";

vi.mock("@/app/actions/taches", () => ({
  annulerCochage: vi.fn(),
  createSousTache: vi.fn(),
  deleteSousTache: vi.fn(),
  deleteTache: vi.fn(),
  enregistrerOrdreTaches: vi.fn(),
  reordonnerSousTaches: vi.fn(),
  toggleSousTache: vi.fn(),
  setTacheFait: vi.fn(),
}));
vi.mock("@/lib/offline/queue", () => ({
  enqueueAction: vi.fn(),
  isNetworkError: () => false,
}));
vi.mock("@/lib/date/recurrence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/date/recurrence")>();
  return { ...actual, aujourdhuiISO: () => "2026-11-10" };
});

afterEach(cleanup);

function monter(taches: ReturnType<typeof makeTache>[], messageVide?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.taches, taches);
  render(
    <QueryClientProvider client={client}>
      <TasksList taches={taches} listes={[]} tags={[]} messageVide={messageVide} />
    </QueryClientProvider>
  );
}

describe("TaskCard : présentation", () => {
  it.each([
    ["2026-11-10", "Aujourd'hui"],
    ["2026-11-11", "Demain"],
    ["2026-11-09", /Hier/],
    ["2026-11-25", /25 nov\.?$/],
  ])("affiche l'échéance %s en langage courant", (echeance, attendu) => {
    monter([makeTache({ id: "t1", titre: "Payer", echeance })]);
    expect(screen.getByText(attendu)).toBeTruthy();
  });

  it("n'affiche l'année que si elle diffère de l'année en cours", () => {
    monter([makeTache({ id: "t1", titre: "Payer", echeance: "2027-02-03" })]);
    expect(screen.getByText(/2027/)).toBeTruthy();
  });

  it("ne montre plus de boutons Modifier / Supprimer permanents : le titre ouvre l'édition", () => {
    monter([makeTache({ id: "t1", titre: "Payer" })]);
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    expect(screen.getByRole("button", { name: /Payer\s*\(modifier\)/ })).toBeTruthy();
  });

  it("affiche le message d'état vide propre à la vue", () => {
    monter([], "Rien en retard. Tout est à jour.");
    expect(screen.getByText("Rien en retard. Tout est à jour.")).toBeTruthy();
  });

  it("explique une seule fois la suppression automatique des Tâches du jour", () => {
    monter([
      makeTache({ id: "t1", titre: "Payer", programme_jour: true }),
      makeTache({ id: "t2", titre: "Ranger", programme_jour: true }),
    ]);
    expect(screen.getAllByText(/supprimées à la fin de la journée/)).toHaveLength(1);
  });

  it("met l'échéance en retard en évidence avec un libellé, pas seulement une couleur", () => {
    monter([makeTache({ id: "t1", titre: "Payer", echeance: "2026-11-08" })]);
    expect(screen.getByText(/En retard · /)).toBeTruthy();
  });

  it("nomme la coche avec le titre de la tâche pour les lecteurs d'écran", () => {
    monter([makeTache({ id: "t1", titre: "Payer" })]);
    expect(screen.getByRole("button", { name: "Marquer « Payer » comme fait" })).toBeTruthy();
  });
});
