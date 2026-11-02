import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentAvecFichiers } from "@/app/actions/documents";

const etat = vi.hoisted(() => ({ obtenir: vi.fn() }));

vi.mock("@/app/actions/documents-description", () => ({ obtenirDescriptionDocument: etat.obtenir }));

import { BoutonDescription } from "./BoutonDescription";

const ID = "11111111-1111-4111-8111-111111111111";

function document(fichiers: number): DocumentAvecFichiers {
  return {
    id: ID,
    nom: "Facture EDF",
    fichiers: Array.from({ length: fichiers }, (_, i) => ({ id: `f${i}` })),
  } as unknown as DocumentAvecFichiers;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("BoutonDescription", () => {
  it("n'apparaît pas quand le document n'a aucun fichier", () => {
    const { container } = render(<BoutonDescription document={document(0)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("est un bouton icône sans texte visible, nommé pour les lecteurs d'écran et en info-bulle", () => {
    render(<BoutonDescription document={document(1)} />);

    const bouton = screen.getByRole("button", { name: "Description de « Facture EDF »" });
    expect(bouton).toHaveAttribute("title", "Description par l'IA");
    expect(bouton.textContent).toBe("");
    expect(bouton.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    // Même gabarit que « Remettre en vrac » : 36 px avec une zone de toucher de 44 px.
    expect(bouton.className).toContain("h-9");
    expect(bouton.className).toContain("w-9");
    expect(bouton.className).toContain("after:-inset-1");
  });

  it("ouvre une fenêtre avec le résumé et les puces", async () => {
    etat.obtenir.mockResolvedValue({
      ok: true,
      data: { resume: "Facture d'électricité de mars.", points: ["Montant : 84,20 €", "Échéance : 15/04"], partiel: false },
    });
    render(<BoutonDescription document={document(1)} />);

    fireEvent.click(screen.getByRole("button", { name: /Description de « Facture EDF »/ }));

    expect(await screen.findByText("Facture d'électricité de mars.")).toBeInTheDocument();
    expect(screen.getByText("Montant : 84,20 €")).toBeInTheDocument();
    expect(screen.getByText("Échéance : 15/04")).toBeInTheDocument();
    expect(screen.queryByText(/premiers fichiers/)).toBeNull();
    expect(etat.obtenir).toHaveBeenCalledWith(ID, false);
  });

  it("précise quand seuls les premiers fichiers ont été lus", async () => {
    etat.obtenir.mockResolvedValue({ ok: true, data: { resume: "Dossier.", points: [], partiel: true } });
    render(<BoutonDescription document={document(5)} />);

    fireEvent.click(screen.getByRole("button", { name: /Description/ }));

    expect(await screen.findByText(/premiers fichiers/)).toBeInTheDocument();
  });

  it("affiche l'erreur et permet de réessayer", async () => {
    etat.obtenir.mockResolvedValueOnce({ ok: false, error: "Quota atteint." });
    render(<BoutonDescription document={document(1)} />);

    fireEvent.click(screen.getByRole("button", { name: /Description/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Quota atteint.");

    etat.obtenir.mockResolvedValueOnce({ ok: true, data: { resume: "Enfin.", points: [], partiel: false } });
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Enfin.")).toBeInTheDocument();
    expect(etat.obtenir).toHaveBeenLastCalledWith(ID, true);
  });

  it("régénère à la demande", async () => {
    etat.obtenir.mockResolvedValue({ ok: true, data: { resume: "Première.", points: [], partiel: false } });
    render(<BoutonDescription document={document(1)} />);
    fireEvent.click(screen.getByRole("button", { name: /Description/ }));
    await screen.findByText("Première.");

    etat.obtenir.mockResolvedValue({ ok: true, data: { resume: "Seconde.", points: [], partiel: false } });
    fireEvent.click(screen.getByRole("button", { name: "Régénérer" }));

    expect(await screen.findByText("Seconde.")).toBeInTheDocument();
    expect(etat.obtenir).toHaveBeenLastCalledWith(ID, true);
  });
});
