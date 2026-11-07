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
    peutTranscrire: true,
    enTranscription: false,
    onTranscrire: vi.fn(),
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

  it("lance la transcription depuis la barre", async () => {
    const props = rendre();
    await userEvent.click(screen.getByRole("button", { name: "Transcrire" }));
    expect(props.onTranscrire).toHaveBeenCalledTimes(1);
  });

  it("grise Transcrire sur une feuille vide", async () => {
    const props = rendre({ peutTranscrire: false });
    const bouton = screen.getByRole("button", { name: "Transcrire" });
    expect(bouton).toBeDisabled();
    await userEvent.click(bouton);
    expect(props.onTranscrire).not.toHaveBeenCalled();
  });

  it("empêche de relancer une transcription en cours et le dit", async () => {
    const props = rendre({ enTranscription: true });
    const bouton = screen.getByRole("button", { name: "Transcription en cours…" });
    expect(bouton).toBeDisabled();
    expect(bouton).toHaveAttribute("aria-busy", "true");
    await userEvent.click(bouton);
    expect(props.onTranscrire).not.toHaveBeenCalled();
  });
});
