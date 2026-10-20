import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuFeuille } from "./MenuFeuille";

afterEach(cleanup);

function rendre(surcharges: Partial<React.ComponentProps<typeof MenuFeuille>> = {}) {
  const props = {
    aTexte: false,
    enTranscription: false,
    peutTranscrire: true,
    peutEffacer: true,
    onTranscrire: vi.fn(),
    onVoirTexte: vi.fn(),
    onEffacer: vi.fn(),
    ...surcharges,
  };
  render(<MenuFeuille {...props} />);
  return props;
}

const ouvrir = () => userEvent.click(screen.getByRole("button", { name: "Plus d'actions" }));

describe("MenuFeuille", () => {
  it("est fermé au départ et s'ouvre avec le bouton « … »", async () => {
    rendre();
    const declencheur = screen.getByRole("button", { name: "Plus d'actions" });
    expect(declencheur).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
    await ouvrir();
    expect(declencheur).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Actions de la feuille" })).toBeInTheDocument();
  });

  it("propose Transcrire et Effacer, sans « Voir le texte » tant qu'il n'y a pas de texte", async () => {
    rendre();
    await ouvrir();
    expect(screen.getByRole("menuitem", { name: "Transcrire" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Effacer la feuille" })).toBeEnabled();
    expect(screen.queryByRole("menuitem", { name: "Voir le texte" })).toBeNull();
  });

  it("propose Voir le texte quand le jour a déjà du texte, sans jamais proposer « Retranscrire »", async () => {
    const props = rendre({ aTexte: true });
    await ouvrir();
    expect(screen.getByRole("menuitem", { name: "Transcrire" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Retranscrire" })).toBeNull();
    await userEvent.click(screen.getByRole("menuitem", { name: "Voir le texte" }));
    expect(props.onVoirTexte).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("lance l'action choisie puis se referme", async () => {
    const props = rendre();
    await ouvrir();
    await userEvent.click(screen.getByRole("menuitem", { name: "Transcrire" }));
    expect(props.onTranscrire).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    await ouvrir();
    await userEvent.click(screen.getByRole("menuitem", { name: "Effacer la feuille" }));
    expect(props.onEffacer).toHaveBeenCalledTimes(1);
  });

  it("désactive Transcrire et Effacer sur une feuille vide", async () => {
    rendre({ peutTranscrire: false, peutEffacer: false });
    await ouvrir();
    expect(screen.getByRole("menuitem", { name: "Transcrire" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Effacer la feuille" })).toBeDisabled();
  });

  it("empêche de relancer une transcription déjà en cours et le dit", async () => {
    const props = rendre({ enTranscription: true });
    expect(screen.getByRole("button", { name: "Transcription en cours…" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Transcription en cours…" }));
    expect(screen.getByRole("menuitem", { name: "Transcription en cours…" })).toBeDisabled();
    expect(props.onTranscrire).not.toHaveBeenCalled();
  });

  it("se ferme avec Échap et rend le focus au bouton", async () => {
    rendre();
    await ouvrir();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Plus d'actions" })).toHaveFocus();
  });

  it("se ferme en touchant ailleurs", async () => {
    rendre();
    await ouvrir();
    await userEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
