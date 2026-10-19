import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarreOutils } from "./BarreOutils";

function rendre(surcharges: Partial<React.ComponentProps<typeof BarreOutils>> = {}) {
  const props = {
    outil: "stylo" as const,
    onOutil: vi.fn(),
    epaisseur: 2 as const,
    onEpaisseur: vi.fn(),
    peutAnnuler: true,
    peutRetablir: false,
    onAnnuler: vi.fn(),
    onRetablir: vi.fn(),
    ...surcharges,
  };
  render(<BarreOutils {...props} />);
  return props;
}

describe("BarreOutils", () => {
  afterEach(cleanup);

  it("signale l'outil et l'épaisseur actifs", () => {
    rendre({ outil: "gomme", epaisseur: 3 });
    expect(screen.getByRole("button", { name: "Gomme" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Stylo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Trait épais" })).toHaveAttribute("aria-pressed", "true");
  });

  it("change d'outil et d'épaisseur", async () => {
    const props = rendre();
    await userEvent.click(screen.getByRole("button", { name: "Gomme" }));
    await userEvent.click(screen.getByRole("button", { name: "Trait fin" }));
    expect(props.onOutil).toHaveBeenCalledWith("gomme");
    expect(props.onEpaisseur).toHaveBeenCalledWith(1);
  });

  it("désactive annuler / rétablir quand il n'y a rien à défaire", async () => {
    const props = rendre({ peutAnnuler: true, peutRetablir: false });
    expect(screen.getByRole("button", { name: "Rétablir" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(props.onAnnuler).toHaveBeenCalledTimes(1);
  });
});
