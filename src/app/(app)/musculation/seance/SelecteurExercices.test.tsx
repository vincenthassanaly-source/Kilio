import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelecteurExercices } from "./SelecteurExercices";

vi.mock("@/app/actions/musculation", () => ({ getExercices: vi.fn().mockResolvedValue([]) }));

// Simule le bouton Retour : le navigateur revient sur l'entrée précédente
// (sans token), puis émet popstate.
function retour() {
  act(() => {
    window.history.replaceState(null, "", window.location.href);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });
}

function Page() {
  const [ouvert, setOuvert] = useState(false);
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <button onClick={() => setOuvert(true)}>ouvrir</button>
      <SelecteurExercices ouvert={ouvert} titre="Remplacer l'exercice" onChoisir={() => {}} onClose={() => setOuvert(false)} />
    </QueryClientProvider>
  );
}

describe("SelecteurExercices", () => {
  afterEach(() => cleanup());

  it("Retour referme la feuille du catalogue au lieu de quitter la page", async () => {
    const { getByText, queryByRole } = render(<Page />);
    const avant = window.history.length;

    act(() => getByText("ouvrir").click());
    expect(queryByRole("dialog")).not.toBeNull();
    expect(window.history.length).toBe(avant + 1);

    retour();

    await waitFor(() => expect(queryByRole("dialog")).toBeNull());
  });
});
