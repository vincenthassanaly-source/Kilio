import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorInline } from "./ErrorInline";

afterEach(() => {
  cleanup();
});

describe("ErrorInline", () => {
  it("annonce le message avec role=alert", () => {
    render(<ErrorInline message="Impossible de charger les courses." />);

    expect(screen.getByRole("alert").textContent).toContain("Impossible de charger les courses.");
  });

  it("relance au clic sur « Réessayer » quand retry est fourni", async () => {
    const retry = vi.fn();
    render(<ErrorInline message="Impossible de charger les notes." retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("n'affiche aucun bouton sans retry (ex. élément introuvable)", () => {
    render(<ErrorInline titre="Collection introuvable" message="Elle n'existe plus." />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("rend le titre en h1 seulement quand il est fourni", () => {
    const { rerender } = render(<ErrorInline titre="Idée introuvable" message="x" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Idée introuvable");

    rerender(<ErrorInline message="x" />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
