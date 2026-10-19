import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoutonRetourBarre } from "./BoutonRetourBarre";

type Rappel = (entrees: Partial<IntersectionObserverEntry>[]) => void;
const observateurs = new Map<Element, Rappel>();

beforeEach(() => {
  observateurs.clear();
  class FauxObserver {
    constructor(private rappel: Rappel) {}
    observe(element: Element) {
      observateurs.set(element, this.rappel);
    }
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", FauxObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function monter(onClick = vi.fn()) {
  const barre = document.createElement("div");
  const panneau = document.createElement("div");
  const barreRef = createRef<HTMLElement>();
  const panneauRef = createRef<HTMLElement>();
  (barreRef as { current: HTMLElement | null }).current = barre;
  (panneauRef as { current: HTMLElement | null }).current = panneau;
  render(<BoutonRetourBarre barreRef={barreRef} panneauRef={panneauRef} onClick={onClick} />);
  const signaler = (element: Element, entree: Partial<IntersectionObserverEntry>) =>
    act(() => observateurs.get(element)?.([entree]));
  return { barre, panneau, signaler, onClick };
}

const NOM = /Remonter aux filtres/;

describe("BoutonRetourBarre", () => {
  it("est absent tant que la barre est visible", () => {
    const { barre, panneau, signaler } = monter();
    signaler(panneau, { isIntersecting: true });
    signaler(barre, { isIntersecting: true, boundingClientRect: { bottom: 120 } as DOMRectReadOnly });
    expect(screen.queryByRole("button", { name: NOM })).toBeNull();
  });

  it("apparaît quand la barre est passée au-dessus de l'écran et que le parti est visible", async () => {
    const { barre, panneau, signaler } = monter();
    signaler(panneau, { isIntersecting: true });
    signaler(barre, { isIntersecting: false, boundingClientRect: { bottom: -40 } as DOMRectReadOnly });
    expect(await screen.findByRole("button", { name: NOM })).toBeInTheDocument();
  });

  it("n'apparaît pas quand la barre est sous l'écran (pas encore atteinte)", () => {
    const { barre, panneau, signaler } = monter();
    signaler(panneau, { isIntersecting: true });
    signaler(barre, { isIntersecting: false, boundingClientRect: { bottom: 1500 } as DOMRectReadOnly });
    expect(screen.queryByRole("button", { name: NOM })).toBeNull();
  });

  it("disparaît quand le parti n'est plus à l'écran", async () => {
    const { barre, panneau, signaler } = monter();
    signaler(barre, { isIntersecting: false, boundingClientRect: { bottom: -40 } as DOMRectReadOnly });
    signaler(panneau, { isIntersecting: true });
    expect(await screen.findByRole("button", { name: NOM })).toBeInTheDocument();
    signaler(panneau, { isIntersecting: false });
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: NOM })).toBeNull());
  });

  it("rappelle onClick au tap", async () => {
    const { barre, panneau, signaler, onClick } = monter();
    signaler(panneau, { isIntersecting: true });
    signaler(barre, { isIntersecting: false, boundingClientRect: { bottom: -40 } as DOMRectReadOnly });
    fireEvent.click(await screen.findByRole("button", { name: NOM }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
