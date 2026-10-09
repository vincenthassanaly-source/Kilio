import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevueHebdoRow } from "./RevueHebdoRow";

vi.mock("@/app/actions/briefing", () => ({ updateReglagesRevue: vi.fn() }));
import { updateReglagesRevue } from "@/app/actions/briefing";

afterEach(() => cleanup());

const reglages = {
  id: 1,
  actif: true,
  heure: "07:30:00",
  dernier_envoi: null,
  revue_actif: true,
  revue_jour: 0,
  revue_heure: "18:00:00",
  revue_dernier_envoi: null,
  updated_at: "2026-10-09T00:00:00Z",
};

describe("RevueHebdoRow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("affiche dimanche 18:00 par défaut", () => {
    render(<RevueHebdoRow reglages={reglages} />);
    expect((screen.getByLabelText("Jour et heure") as HTMLSelectElement).value).toBe("0");
    expect((screen.getByLabelText("Heure du rappel de revue") as HTMLInputElement).value).toBe("18:00");
  });

  it("enregistre un changement de jour", async () => {
    vi.mocked(updateReglagesRevue).mockResolvedValue({ ok: true, data: undefined });
    render(<RevueHebdoRow reglages={reglages} />);
    await userEvent.selectOptions(screen.getByLabelText("Jour et heure"), "5");
    await waitFor(() => expect(updateReglagesRevue).toHaveBeenCalledWith(true, 5, "18:00"));
  });

  it("enregistre une nouvelle heure à la sortie du champ", async () => {
    vi.mocked(updateReglagesRevue).mockResolvedValue({ ok: true, data: undefined });
    render(<RevueHebdoRow reglages={reglages} />);
    const champ = screen.getByLabelText("Heure du rappel de revue");
    fireEvent.change(champ, { target: { value: "19:15" } });
    fireEvent.blur(champ);
    await waitFor(() => expect(updateReglagesRevue).toHaveBeenCalledWith(true, 0, "19:15"));
  });

  it("revient à l'état précédent si l'enregistrement échoue", async () => {
    vi.mocked(updateReglagesRevue).mockResolvedValue({ ok: false, error: "Le réglage n'a pas pu être enregistré. Réessaie." });
    render(<RevueHebdoRow reglages={reglages} />);
    await userEvent.selectOptions(screen.getByLabelText("Jour et heure"), "3");
    expect((await screen.findByRole("alert")).textContent).toMatch(/pas pu être enregistré/);
    await waitFor(() => expect((screen.getByLabelText("Jour et heure") as HTMLSelectElement).value).toBe("0"));
  });

  it("désactivé : masque le jour et l'heure", async () => {
    vi.mocked(updateReglagesRevue).mockResolvedValue({ ok: true, data: undefined });
    render(<RevueHebdoRow reglages={reglages} />);
    await userEvent.click(screen.getByRole("switch", { name: "Rappel de la revue hebdomadaire" }));
    await waitFor(() => expect(updateReglagesRevue).toHaveBeenCalledWith(false, 0, "18:00"));
    expect(screen.queryByLabelText("Jour et heure")).toBeNull();
  });
});
