import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  proposer: vi.fn(),
  appliquer: vi.fn(),
  annuler: vi.fn(),
  toastAction: vi.fn(),
  toastErreur: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/app/actions/documents-reorganisation", () => ({
  proposerReorganisation: etat.proposer,
  appliquerReorganisation: etat.appliquer,
  annulerReorganisation: etat.annuler,
}));
vi.mock("@/components/Modal", () => ({
  Modal: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/toast/toast-store", () => ({
  showActionToast: etat.toastAction,
  showErrorToast: etat.toastErreur,
  showToast: etat.toast,
}));

import { ReorganiserModal } from "./ReorganiserModal";

const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const CATEGORIES = ["Autre", "Santé"];

function proposition(extra: Record<string, unknown> = {}) {
  return {
    statut: "ok",
    changements: [
      { id: D1, nom: "Fiche de paie - mars", de: "Autre", vers: "Travail", nouvelle: true },
      { id: D2, nom: "Fiche de paie - avril", de: "Autre", vers: "Travail", nouvelle: true },
    ],
    comptes: { Autre: 2 },
    analyses: 3,
    tronque: false,
    ...extra,
  };
}

const APPLICATION = {
  ok: true,
  data: {
    appliques: 2,
    echecs: 0,
    raison: null,
    anciennes: [{ id: D1, de: "Autre" }, { id: D2, de: "Autre" }],
    creees: ["Travail"],
    supprimees: ["Autre"],
  },
};

async function ouvrirApercu(onClose = vi.fn()) {
  render(<ReorganiserModal categories={CATEGORIES} onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: /Proposer/ }));
  await screen.findByRole("button", { name: /Appliquer/ });
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.proposer.mockResolvedValue(proposition());
  etat.appliquer.mockResolvedValue(APPLICATION);
  etat.annuler.mockResolvedValue({ ok: true, data: { restaures: 2 } });
});
afterEach(cleanup);

describe("ReorganiserModal", () => {
  it("n'appelle Gemini qu'au clic sur « Proposer », avec la préférence saisie", async () => {
    render(<ReorganiserModal categories={CATEGORIES} onClose={vi.fn()} />);
    expect(etat.proposer).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Une préférence/), { target: { value: "pas plus de 8 catégories" } });
    fireEvent.click(screen.getByRole("button", { name: /Proposer/ }));

    await screen.findByRole("button", { name: /Appliquer/ });
    expect(etat.proposer).toHaveBeenCalledWith("pas plus de 8 catégories");
  });

  it("montre les changements groupés, la catégorie nouvelle et la catégorie qui sera vidée", async () => {
    await ouvrirApercu();

    expect(screen.getByLabelText("Reclasser 2 documents de Autre vers Travail")).toBeChecked();
    expect(screen.getByText(/Nouvelle catégorie :/)).toHaveTextContent("Travail");
    expect(screen.getByRole("button", { name: "Appliquer (2)" })).toBeEnabled();
    expect(screen.getByLabelText(/Supprimer la catégorie vidée/)).toBeChecked();
    // Rien n'a été écrit avant « Appliquer ».
    expect(etat.appliquer).not.toHaveBeenCalled();
  });

  it("applique les changements validés, ferme la fenêtre et propose d'annuler", async () => {
    const onClose = await ouvrirApercu();

    fireEvent.click(screen.getByRole("button", { name: "Appliquer (2)" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(etat.appliquer).toHaveBeenCalledWith(
      [{ id: D1, vers: "Travail" }, { id: D2, vers: "Travail" }],
      true
    );
    expect(etat.toastAction).toHaveBeenCalledWith(
      "2 documents reclassés",
      expect.objectContaining({ ariaLabel: "Annuler la réorganisation" })
    );

    // « Annuler » remet tout en place avec ce que l'application a renvoyé.
    const { onAction } = etat.toastAction.mock.calls[0][1];
    onAction();
    await waitFor(() => expect(etat.toast).toHaveBeenCalledWith("Réorganisation annulée"));
    expect(etat.annuler).toHaveBeenCalledWith(APPLICATION.data.anciennes, ["Travail"], ["Autre"]);
  });

  it("n'applique pas un document décoché, et la catégorie n'est plus annoncée comme vidée", async () => {
    await ouvrirApercu();

    fireEvent.click(screen.getByLabelText("Reclasser Fiche de paie - avril"));

    expect(screen.getByRole("button", { name: "Appliquer (1)" })).toBeEnabled();
    expect(screen.queryByLabelText(/Supprimer la catégorie vidée/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Appliquer (1)" }));
    await waitFor(() => expect(etat.appliquer).toHaveBeenCalled());
    expect(etat.appliquer).toHaveBeenCalledWith([{ id: D1, vers: "Travail" }], true);
  });

  it("garde la catégorie quand la case de suppression est décochée", async () => {
    await ouvrirApercu();

    fireEvent.click(screen.getByLabelText(/Supprimer la catégorie vidée/));
    fireEvent.click(screen.getByRole("button", { name: "Appliquer (2)" }));

    await waitFor(() => expect(etat.appliquer).toHaveBeenCalled());
    expect(etat.appliquer.mock.calls[0][1]).toBe(false);
  });

  it("applique la destination choisie à la place de celle de Gemini", async () => {
    await ouvrirApercu();

    fireEvent.change(screen.getByLabelText("Catégorie de destination pour Autre"), { target: { value: "Santé" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer (2)" }));

    await waitFor(() => expect(etat.appliquer).toHaveBeenCalled());
    expect(etat.appliquer.mock.calls[0][0]).toEqual([
      { id: D1, vers: "Santé" },
      { id: D2, vers: "Santé" },
    ]);
  });

  it("ferme sans rien écrire quand on annule l'aperçu", async () => {
    const onClose = await ouvrirApercu();

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onClose).toHaveBeenCalled();
    expect(etat.appliquer).not.toHaveBeenCalled();
  });

  it("reste sur l'écran de départ avec le message quand Gemini échoue", async () => {
    etat.proposer.mockResolvedValue({ statut: "echec", erreur: "Quota atteint.", quota: true });
    render(<ReorganiserModal categories={CATEGORIES} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Proposer/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Quota atteint.");
    expect(screen.getByRole("button", { name: /Proposer/ })).toBeInTheDocument();
  });

  it("dit que le classement est déjà cohérent quand il n'y a rien à changer", async () => {
    etat.proposer.mockResolvedValue(proposition({ changements: [] }));
    render(<ReorganiserModal categories={CATEGORIES} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Proposer/ }));

    expect(await screen.findByRole("status")).toHaveTextContent("déjà cohérent");
    expect(screen.queryByRole("button", { name: /Appliquer/ })).toBeNull();
  });

  it("revient à l'aperçu avec l'erreur quand l'application échoue", async () => {
    etat.appliquer.mockResolvedValue({ ok: false, error: "La réorganisation n'a pas pu être appliquée. Réessaie." });
    const onClose = await ouvrirApercu();

    fireEvent.click(screen.getByRole("button", { name: "Appliquer (2)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("n'a pas pu être appliquée");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Appliquer (2)" })).toBeEnabled();
  });
});
