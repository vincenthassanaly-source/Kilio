import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ remettre: vi.fn() }));

vi.mock("./remettreEnVrac", () => ({ remettreEnVrac: etat.remettre }));

import { BoutonRemettreEnVrac } from "./BoutonRemettreEnVrac";

const DOCUMENT = { id: "11111111-1111-4111-8111-111111111111", nom: "Carte d'identité" };

beforeEach(() => {
  vi.clearAllMocks();
  etat.remettre.mockResolvedValue(true);
});
afterEach(cleanup);

describe("BoutonRemettreEnVrac", () => {
  it("est un bouton icône sans texte visible, nommé pour les lecteurs d'écran et en info-bulle", () => {
    render(<BoutonRemettreEnVrac document={DOCUMENT} />);

    const bouton = screen.getByRole("button", { name: "Remettre « Carte d'identité » en vrac" });
    expect(bouton).toHaveAttribute("title", "Remettre en vrac");
    // Aucun texte visible : seule l'icône (SVG décoratif) est affichée.
    expect(bouton.textContent).toBe("");
    expect(bouton.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("reste petit (36 px) avec une zone de toucher étendue à 44 px", () => {
    render(<BoutonRemettreEnVrac document={DOCUMENT} />);

    const classes = screen.getByRole("button").className;
    expect(classes).toContain("h-9");
    expect(classes).toContain("w-9");
    expect(classes).toContain("after:-inset-1");
  });

  it("remet le document en vrac au toucher", async () => {
    render(<BoutonRemettreEnVrac document={DOCUMENT} />);

    fireEvent.click(screen.getByRole("button"));

    await vi.waitFor(() => expect(etat.remettre).toHaveBeenCalledWith(DOCUMENT));
  });
});
