import { act, cleanup, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBackClose } from "./useBackClose";

// Simule le bouton Retour : le navigateur revient sur l'entrée précédente
// (sans token), puis émet popstate.
function retour() {
  act(() => {
    window.history.replaceState(null, "", window.location.href);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });
}

// Même câblage que l'agenda : deux fenêtres, une seule entrée d'historique.
function Fenetres() {
  const [menu, setMenu] = useState(false);
  const [evenement, setEvenement] = useState(false);
  useBackClose(menu || evenement, () => {
    setMenu(false);
    setEvenement(false);
  });
  return (
    <div>
      <button onClick={() => setEvenement(true)}>ouvrir-evenement</button>
      <button onClick={() => setMenu(true)}>ouvrir-menu</button>
      <button onClick={() => setEvenement(false)}>fermer-evenement</button>
      {evenement && <p>fenetre-evenement</p>}
      {menu && <p>fenetre-menu</p>}
    </div>
  );
}

describe("useBackClose", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("pousse une entrée d'historique à l'ouverture et pas avant", () => {
    const { getByText } = render(<Fenetres />);
    const avant = window.history.length;
    act(() => getByText("ouvrir-evenement").click());
    expect(window.history.length).toBe(avant + 1);
    expect((window.history.state as { backCloseToken?: string }).backCloseToken).toBeTruthy();
  });

  it("Retour ferme la fenêtre Événement au lieu de quitter la page", () => {
    const { getByText, queryByText } = render(<Fenetres />);
    act(() => getByText("ouvrir-evenement").click());
    expect(queryByText("fenetre-evenement")).not.toBeNull();

    retour();

    expect(queryByText("fenetre-evenement")).toBeNull();
  });

  it("Retour ferme aussi l'autre fenêtre gérée par la même entrée", () => {
    const { getByText, queryByText } = render(<Fenetres />);
    act(() => getByText("ouvrir-menu").click());
    retour();
    expect(queryByText("fenetre-menu")).toBeNull();
  });

  it("une fermeture par l'interface dépile l'entrée d'historique", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { getByText } = render(<Fenetres />);
    act(() => getByText("ouvrir-evenement").click());
    expect(back).not.toHaveBeenCalled();

    act(() => getByText("fermer-evenement").click());

    expect(back).toHaveBeenCalledTimes(1);
  });

  it("ne réagit pas à un Retour quand aucune fenêtre n'est ouverte", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<Fenetres />);
    retour();
    expect(back).not.toHaveBeenCalled();
  });
});
