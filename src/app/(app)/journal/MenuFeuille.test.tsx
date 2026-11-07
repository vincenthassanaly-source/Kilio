import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuFeuille } from "./MenuFeuille";

afterEach(cleanup);

function rendre(surcharges: Partial<React.ComponentProps<typeof MenuFeuille>> = {}) {
  const props = {
    aTexte: false,
    enTranscription: false,
    peutEffacer: true,
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

  it("propose Effacer, sans « Voir le texte » tant qu'il n'y a pas de texte, et ne propose plus Transcrire", async () => {
    rendre();
    await ouvrir();
    expect(screen.getByRole("menuitem", { name: "Effacer la feuille" })).toBeEnabled();
    expect(screen.queryByRole("menuitem", { name: "Voir le texte" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Transcrire" })).toBeNull();
  });

  it("propose Voir le texte quand le jour a déjà du texte", async () => {
    const props = rendre({ aTexte: true });
    await ouvrir();
    await userEvent.click(screen.getByRole("menuitem", { name: "Voir le texte" }));
    expect(props.onVoirTexte).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("lance l'action choisie puis se referme", async () => {
    const props = rendre();
    await ouvrir();
    await userEvent.click(screen.getByRole("menuitem", { name: "Effacer la feuille" }));
    expect(props.onEffacer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("désactive Effacer sur une feuille vide", async () => {
    rendre({ peutEffacer: false });
    await ouvrir();
    expect(screen.getByRole("menuitem", { name: "Effacer la feuille" })).toBeDisabled();
  });

  it("signale une transcription en cours sur le bouton « … »", () => {
    rendre({ enTranscription: true });
    expect(screen.getByRole("button", { name: "Transcription en cours…" })).toHaveAttribute("aria-busy", "true");
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
