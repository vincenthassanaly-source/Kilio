import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BriefingRow } from "./BriefingRow";

vi.mock("@/app/actions/briefing", () => ({ updateReglagesBriefing: vi.fn() }));
import { updateReglagesBriefing } from "@/app/actions/briefing";

afterEach(() => cleanup());

const reglages = { id: 1, actif: true, heure: "07:30:00", dernier_envoi: null, updated_at: "2026-10-09T00:00:00Z" };

describe("BriefingRow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("affiche l'heure enregistrée sans les secondes", () => {
    render(<BriefingRow reglages={reglages} />);
    expect((screen.getByLabelText("Heure d'envoi") as HTMLInputElement).value).toBe("07:30");
  });

  it("enregistre une nouvelle heure à la sortie du champ", async () => {
    vi.mocked(updateReglagesBriefing).mockResolvedValue({ ok: true, data: undefined });
    render(<BriefingRow reglages={reglages} />);
    const champ = screen.getByLabelText("Heure d'envoi");
    fireEvent.change(champ, { target: { value: "08:15" } });
    fireEvent.blur(champ);
    await waitFor(() => expect(updateReglagesBriefing).toHaveBeenCalledWith(true, "08:15"));
  });

  it("désactive le briefing et masque l'heure", async () => {
    vi.mocked(updateReglagesBriefing).mockResolvedValue({ ok: true, data: undefined });
    render(<BriefingRow reglages={reglages} />);
    await userEvent.click(screen.getByRole("switch", { name: "Briefing du matin" }));
    await waitFor(() => expect(updateReglagesBriefing).toHaveBeenCalledWith(false, "07:30"));
    expect(screen.queryByLabelText("Heure d'envoi")).toBeNull();
  });

  it("revient à l'état précédent si l'enregistrement échoue", async () => {
    vi.mocked(updateReglagesBriefing).mockResolvedValue({ ok: false, error: "Le réglage n'a pas pu être enregistré. Réessaie." });
    render(<BriefingRow reglages={reglages} />);
    await userEvent.click(screen.getByRole("switch", { name: "Briefing du matin" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/pas pu être enregistré/);
    expect(screen.getByLabelText("Heure d'envoi")).toBeTruthy();
  });
});
