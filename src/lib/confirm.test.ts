import { describe, expect, it, vi } from "vitest";
import { confirmDelete, ecouterConfirmations, type DemandeConfirmation } from "./confirm";

describe("confirmDelete", () => {
  it("replie sur window.confirm quand aucun hôte n'est monté", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await expect(confirmDelete("Supprimer ?")).resolves.toBe(true);
  });

  it("publie la demande à l'hôte et se résout selon la réponse", async () => {
    let demande: DemandeConfirmation | null = null;
    const arreter = ecouterConfirmations((d) => {
      demande = d;
    });

    const promesse = confirmDelete("Retirer « Poulet » du menu ?");
    expect(demande).not.toBeNull();
    expect((demande as unknown as DemandeConfirmation).confirmer).toBe("Retirer");
    (demande as unknown as DemandeConfirmation).resoudre(true);

    await expect(promesse).resolves.toBe(true);
    expect(demande).toBeNull();
    arreter();
  });

  it("refuse la demande précédente quand une nouvelle arrive", async () => {
    const arreter = ecouterConfirmations(() => {});
    const premiere = confirmDelete("A ?");
    const seconde = confirmDelete("B ?");

    await expect(premiere).resolves.toBe(false);
    arreter();
    void seconde;
  });
});
