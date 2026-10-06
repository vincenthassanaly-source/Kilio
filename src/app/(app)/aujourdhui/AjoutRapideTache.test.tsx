import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AjoutRapideTache } from "./AjoutRapideTache";
import { queryKeys } from "@/lib/query/keys";
import { getToasts } from "@/components/toast/toast-store";

vi.mock("@/app/actions/taches", () => ({
  createTache: vi.fn(),
  getListes: vi.fn(async () => [{ id: "liste-1" }, { id: "liste-2" }]),
}));

import { createTache } from "@/app/actions/taches";

afterEach(() => {
  cleanup();
});

const TODAY = "2026-10-06";

function monter(onCreated = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.listes, [{ id: "liste-1" }, { id: "liste-2" }]);
  render(
    <QueryClientProvider client={client}>
      <AjoutRapideTache today={TODAY} onCreated={onCreated} />
    </QueryClientProvider>
  );
  return { onCreated };
}

describe("AjoutRapideTache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée la tâche pour aujourd'hui dans la première liste, puis vide le champ", async () => {
    vi.mocked(createTache).mockResolvedValue({ error: null, id: "t1" });
    const { onCreated } = monter();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nouvelle tâche pour aujourd'hui"), "Appeler Paul{Enter}");

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("t1"));
    const formData = vi.mocked(createTache).mock.calls[0][1];
    expect(formData.get("titre")).toBe("Appeler Paul");
    expect(formData.get("echeance")).toBe(TODAY);
    expect(formData.get("liste_id")).toBe("liste-1");
    expect(formData.has("heure")).toBe(false);
    expect(screen.getByLabelText("Nouvelle tâche pour aujourd'hui")).toHaveValue("");
  });

  it("transmet l'heure choisie via la pastille « Heure »", async () => {
    vi.mocked(createTache).mockResolvedValue({ error: null, id: "t2" });
    const { onCreated } = monter();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Heure" }));
    await user.type(screen.getByLabelText("Heure"), "14:30");
    await user.type(screen.getByLabelText("Nouvelle tâche pour aujourd'hui"), "Dentiste");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("t2"));
    expect(vi.mocked(createTache).mock.calls[0][1].get("heure")).toBe("14:30");
  });

  it("garde le texte saisi et affiche une erreur si la création échoue", async () => {
    vi.mocked(createTache).mockResolvedValue({ error: "Le titre est requis." });
    const { onCreated } = monter();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nouvelle tâche pour aujourd'hui"), "Acheter du pain{Enter}");

    await waitFor(() => expect(getToasts().some((t) => t.text === "Le titre est requis.")).toBe(true));
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nouvelle tâche pour aujourd'hui")).toHaveValue("Acheter du pain");
  });

  it("n'appelle pas le serveur pour un titre vide", async () => {
    monter();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nouvelle tâche pour aujourd'hui"), "   {Enter}");

    expect(createTache).not.toHaveBeenCalled();
  });
});
