import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SaisieClavier } from "./SaisieClavier";
import { oublierBrouillons } from "./brouillonClavier";

const zone = () => screen.getByLabelText("Ce que tu as en tête") as HTMLTextAreaElement;

afterEach(() => {
  cleanup();
  oublierBrouillons();
});

describe("SaisieClavier : le brouillon survit à un démontage", () => {
  it("retrouve le texte tapé après la bascule Stylo/Clavier (démontage puis remontage)", () => {
    const { unmount } = render(<SaisieClavier jour="2026-11-12" onAjouter={vi.fn()} />);
    fireEvent.change(zone(), { target: { value: "Idée à ne pas perdre" } });
    unmount();

    render(<SaisieClavier jour="2026-11-12" onAjouter={vi.fn()} />);
    expect(zone().value).toBe("Idée à ne pas perdre");
  });

  it("ne mélange pas les brouillons de deux jours", () => {
    const { unmount } = render(<SaisieClavier jour="2026-11-12" onAjouter={vi.fn()} />);
    fireEvent.change(zone(), { target: { value: "texte du 12" } });
    unmount();

    render(<SaisieClavier jour="2026-11-11" onAjouter={vi.fn()} />);
    expect(zone().value).toBe("");
  });

  it("vide le brouillon une fois la note ajoutée", async () => {
    const onAjouter = vi.fn().mockResolvedValue(true);
    const { unmount } = render(<SaisieClavier jour="2026-11-12" onAjouter={onAjouter} />);
    fireEvent.change(zone(), { target: { value: "Note" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(zone().value).toBe(""));
    unmount();

    render(<SaisieClavier jour="2026-11-12" onAjouter={onAjouter} />);
    expect(zone().value).toBe("");
  });

  it("garde le brouillon quand l'ajout échoue", async () => {
    const onAjouter = vi.fn().mockResolvedValue(false);
    const { unmount } = render(<SaisieClavier jour="2026-11-12" onAjouter={onAjouter} />);
    fireEvent.change(zone(), { target: { value: "Note" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(onAjouter).toHaveBeenCalled());
    unmount();

    render(<SaisieClavier jour="2026-11-12" onAjouter={onAjouter} />);
    expect(zone().value).toBe("Note");
  });

  it("ne persiste rien dans le stockage du navigateur (texte intime, protégé par le verrou)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<SaisieClavier jour="2026-11-12" onAjouter={vi.fn()} />);
    fireEvent.change(zone(), { target: { value: "secret" } });
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
