import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnimationMiniature } from "./AnimationExercice";

// Simule le bouton Retour : le navigateur revient sur l'entrée précédente
// (sans token), puis émet popstate.
function retour() {
  act(() => {
    window.history.replaceState(null, "", window.location.href);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });
}

describe("AnimationMiniature", () => {
  afterEach(() => cleanup());

  it("Retour referme l'animation agrandie au lieu de quitter la séance", async () => {
    const { getByLabelText, queryByRole } = render(<AnimationMiniature animation="curl-biceps" nom="Curl biceps" />);
    const avant = window.history.length;

    act(() => getByLabelText("Agrandir l'animation de Curl biceps").click());
    expect(queryByRole("dialog")).not.toBeNull();
    expect(window.history.length).toBe(avant + 1);

    retour();

    // AnimatePresence garde la feuille montée le temps de l'animation de sortie.
    await waitFor(() => expect(queryByRole("dialog")).toBeNull());
  });
});
