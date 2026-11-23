import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuActions } from "./MenuActions";

afterEach(cleanup);

describe("MenuActions", () => {
  it("s'ouvre, lance l'action choisie et se referme", async () => {
    const onSelect = vi.fn();
    render(<MenuActions libelleMenu="Actions" actions={[{ libelle: "Réorganiser", onSelect }]} />);
    const bouton = screen.getByRole("button", { name: "Plus d'actions" });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(bouton);
    expect(screen.getByRole("menuitem", { name: "Réorganiser" })).toHaveFocus();
    await userEvent.click(screen.getByRole("menuitem", { name: "Réorganiser" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("se ferme avec Échap et rend le focus au bouton", async () => {
    render(<MenuActions libelleMenu="Actions" actions={[{ libelle: "A", onSelect: vi.fn() }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Plus d'actions" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Plus d'actions" })).toHaveFocus();
  });

  it("ne rend rien sans action", () => {
    const { container } = render(<MenuActions libelleMenu="Actions" actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
