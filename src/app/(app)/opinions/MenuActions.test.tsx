import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuActions } from "./MenuActions";

afterEach(cleanup);

describe("MenuActions", () => {
  it("range les suppressions en dernier, au style neutre", () => {
    const supprimer = vi.fn();
    const modifier = vi.fn();
    render(
      <MenuActions
        libelle="Gérer le parti"
        actions={[
          { libelle: "Supprimer le programme", onSelect: supprimer, suppression: true },
          { libelle: "Modifier le programme", onSelect: modifier },
        ]}
      />,
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gérer le parti" }));
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Modifier le programme", "Supprimer le programme"]);
    expect(items[1].className).toContain("text-ink-2");
    expect(items[1].className).toContain("hover:text-alert");

    fireEvent.click(items[1]);
    expect(supprimer).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Échap ferme le menu", () => {
    render(<MenuActions libelle="Actions" actions={[{ libelle: "Modifier", onSelect: vi.fn() }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
