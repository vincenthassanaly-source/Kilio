import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EvenementForm } from "./EvenementForm";

vi.mock("@/app/actions/evenements", () => ({
  createEvenement: vi.fn(),
  updateEvenement: vi.fn(),
}));

import { createEvenement, updateEvenement } from "@/app/actions/evenements";

afterEach(() => {
  cleanup();
});

describe("EvenementForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse un titre vide sans appeler le serveur", async () => {
    const onSaved = vi.fn();
    render(<EvenementForm dateParDefaut="2026-10-04" onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Le titre est requis.");
    expect(createEvenement).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("crée l'événement avec la date, l'heure et la durée saisies", async () => {
    vi.mocked(createEvenement).mockResolvedValue({ ok: true, data: { id: "e1" } });
    const onSaved = vi.fn();
    render(<EvenementForm dateParDefaut="2026-10-04" onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Titre"), "Dentiste");
    fireEvent.change(screen.getByLabelText("Heure"), { target: { value: "14:30" } });
    await userEvent.selectOptions(screen.getByLabelText("Durée"), "90");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() =>
      expect(createEvenement).toHaveBeenCalledWith({
        titre: "Dentiste",
        date: "2026-10-04",
        heure: "14:30",
        dureeMinutes: 90,
      })
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("garde la saisie et affiche l'erreur du serveur", async () => {
    vi.mocked(createEvenement).mockResolvedValue({ ok: false, error: "La durée doit tenir dans la journée." });
    const onSaved = vi.fn();
    render(<EvenementForm dateParDefaut="2026-10-04" onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Titre"), "Nuit");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    expect((await screen.findByRole("alert")).textContent).toBe("La durée doit tenir dans la journée.");
    expect((screen.getByLabelText("Titre") as HTMLInputElement).value).toBe("Nuit");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("modifie un événement existant et propose la suppression", async () => {
    vi.mocked(updateEvenement).mockResolvedValue({ ok: true, data: undefined });
    const onSupprimer = vi.fn();
    const onSaved = vi.fn();
    render(
      <EvenementForm
        evenement={{
          id: "e1",
          titre: "Appel",
          date: "2026-10-05",
          heure: "09:00:00",
          heure_fin: "09:45:00",
          notes: null,
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        }}
        dateParDefaut="2026-10-04"
        onSaved={onSaved}
        onSupprimer={onSupprimer}
      />
    );

    expect((screen.getByLabelText("Durée") as HTMLSelectElement).value).toBe("45");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(updateEvenement).toHaveBeenCalledWith("e1", {
        titre: "Appel",
        date: "2026-10-05",
        heure: "09:00",
        dureeMinutes: 45,
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(onSupprimer).toHaveBeenCalledTimes(1);
  });
});
