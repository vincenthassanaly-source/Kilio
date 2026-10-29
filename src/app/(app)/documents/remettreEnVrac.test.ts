import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ definir: vi.fn(), actionToast: vi.fn(), erreurToast: vi.fn() }));

vi.mock("@/app/actions/documents-vrac", () => ({ definirDocumentEnVrac: etat.definir }));
vi.mock("@/components/toast/toast-store", () => ({
  showActionToast: etat.actionToast,
  showErrorToast: etat.erreurToast,
}));

import { remettreEnVrac } from "./remettreEnVrac";

const DOCUMENT = { id: "11111111-1111-4111-8111-111111111111", nom: "Facture EDF - mars 2026" };

beforeEach(() => vi.clearAllMocks());

describe("remettreEnVrac", () => {
  it("passe le document en vrac puis propose d'annuler", async () => {
    etat.definir.mockResolvedValue({ ok: true, data: undefined });

    expect(await remettreEnVrac(DOCUMENT)).toBe(true);

    expect(etat.definir).toHaveBeenCalledWith(DOCUMENT.id, true);
    expect(etat.actionToast).toHaveBeenCalledTimes(1);
    const [texte, options] = etat.actionToast.mock.calls[0];
    expect(texte).toBe("« Facture EDF - mars 2026 » remis en vrac");
    expect(options.ariaLabel).toBe("Annuler la remise en vrac de « Facture EDF - mars 2026 »");
  });

  it("« Annuler » remet le document hors du vrac", async () => {
    etat.definir.mockResolvedValue({ ok: true, data: undefined });
    await remettreEnVrac(DOCUMENT);
    etat.definir.mockClear();

    etat.actionToast.mock.calls[0][1].onAction();
    await vi.waitFor(() => expect(etat.definir).toHaveBeenCalledWith(DOCUMENT.id, false));
  });

  it("n'affiche pas de message d'annulation quand la remise en vrac échoue, et signale l'échec", async () => {
    etat.definir.mockResolvedValue({ ok: false, error: "Le document n'a pas pu être remis en vrac. Réessaie." });

    expect(await remettreEnVrac(DOCUMENT)).toBe(false);

    expect(etat.actionToast).not.toHaveBeenCalled();
    expect(etat.erreurToast).toHaveBeenCalledWith("Le document n'a pas pu être remis en vrac. Réessaie.");
  });

  it("signale aussi un échec inattendu de l'appel serveur", async () => {
    etat.definir.mockRejectedValue(new Error("boom"));

    expect(await remettreEnVrac(DOCUMENT)).toBe(false);

    expect(etat.actionToast).not.toHaveBeenCalled();
    expect(etat.erreurToast).toHaveBeenCalledTimes(1);
  });
});
