import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranscriptionDialog } from "./TranscriptionDialog";

const copier = vi.fn();
const afficherToast = vi.fn();
const afficherErreur = vi.fn();
vi.mock("@/components/toast/toast-store", () => ({
  showToast: (...a: unknown[]) => afficherToast(...a),
  showErrorToast: (...a: unknown[]) => afficherErreur(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  copier.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: copier }, configurable: true });
});
afterEach(cleanup);

function rendre(surcharges: Partial<React.ComponentProps<typeof TranscriptionDialog>> = {}) {
  const props = {
    open: true,
    mode: "texte" as const,
    texte: "Ma journée",
    onFermer: vi.fn(),
    onValider: vi.fn().mockResolvedValue(undefined),
    onSupprimer: vi.fn(),
    ...surcharges,
  };
  render(<TranscriptionDialog {...props} />);
  return props;
}

describe("TranscriptionDialog : texte du jour", () => {
  it("n'affiche rien quand il est fermé", () => {
    rendre({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("montre le texte du jour dans un champ modifiable", () => {
    rendre();
    expect(screen.getByRole("dialog", { name: "Texte du jour" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Texte du jour" })).toHaveValue("Ma journée");
    expect(screen.queryByRole("button", { name: "Valider" })).toBeNull();
  });

  it("copie le texte actuel du champ, corrections comprises", async () => {
    rendre();
    const champ = screen.getByRole("textbox", { name: "Texte du jour" });
    await userEvent.clear(champ);
    await userEvent.type(champ, "Texte corrigé");
    await userEvent.click(screen.getByRole("button", { name: "Copier" }));
    expect(copier).toHaveBeenCalledWith("Texte corrigé");
    expect(afficherToast).toHaveBeenCalledWith("Texte copié");
  });

  it("transmet le texte corrigé en se fermant, pour qu'il soit enregistré", async () => {
    const props = rendre();
    const champ = screen.getByRole("textbox", { name: "Texte du jour" });
    await userEvent.type(champ, " !");
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(props.onFermer).toHaveBeenCalledWith("Ma journée !");
  });

  it("se ferme sans modification : le texte transmis est celui d'origine", async () => {
    const props = rendre();
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(props.onFermer).toHaveBeenCalledWith("Ma journée");
  });

  it("propose de supprimer le texte sans toucher à l'écriture", async () => {
    const props = rendre();
    await userEvent.click(screen.getByRole("button", { name: "Supprimer le texte" }));
    expect(props.onSupprimer).toHaveBeenCalledTimes(1);
  });

  it("signale clairement un échec de copie", async () => {
    copier.mockRejectedValue(new Error("refusé"));
    rendre();
    await userEvent.click(screen.getByRole("button", { name: "Copier" }));
    expect(afficherErreur).toHaveBeenCalledWith("Copie impossible : sélectionne le texte à la main.");
  });
});

describe("TranscriptionDialog : proposition à valider", () => {
  it("propose Valider, sans « Supprimer le texte »", () => {
    rendre({ mode: "proposition" });
    expect(screen.getByRole("dialog", { name: "Texte transcrit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Valider" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Supprimer le texte" })).toBeNull();
  });

  it("valide le texte tel qu'il est dans le champ, corrections comprises", async () => {
    const props = rendre({ mode: "proposition" });
    await userEvent.type(screen.getByRole("textbox", { name: "Texte transcrit" }), " !");
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(props.onValider).toHaveBeenCalledWith("Ma journée !");
  });

  it("ne permet pas de valider un champ vidé", async () => {
    rendre({ mode: "proposition" });
    await userEvent.clear(screen.getByRole("textbox", { name: "Texte transcrit" }));
    expect(screen.getByRole("button", { name: "Valider" })).toBeDisabled();
  });
});
