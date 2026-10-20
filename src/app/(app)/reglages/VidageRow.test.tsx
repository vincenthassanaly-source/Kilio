import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VidageRow } from "./VidageRow";

vi.mock("@/app/actions/vidage", () => ({ updateReglagesVidage: vi.fn() }));
import { updateReglagesVidage } from "@/app/actions/vidage";

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
  alerte_kcal_actif: true,
  alerte_kcal_dernier_envoi: null,
  rappel_saisie_actif: true,
  rappel_saisie_heure: "20:00:00",
  rappel_saisie_dernier_envoi: null,
  bilan_actif: true,
  bilan_jour: 0,
  bilan_heure: "18:00:00",
  bilan_dernier_envoi: null,
  vidage_actif: true,
  vidage_heure: "21:00:00",
  vidage_dernier_envoi: null,
  updated_at: "2026-10-19T00:00:00Z",
};

describe("VidageRow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("affiche l'heure réglée quand le rappel est actif", () => {
    render(<VidageRow reglages={reglages} />);
    expect((screen.getByLabelText("Heure du rappel") as HTMLInputElement).value).toBe("21:00");
  });

  it("ne plante pas tant que la migration n'a pas ajouté les colonnes vidage_*", () => {
    const sansMigration: Partial<typeof reglages> = { ...reglages };
    delete sansMigration.vidage_actif;
    delete sansMigration.vidage_heure;
    delete sansMigration.vidage_dernier_envoi;
    render(<VidageRow reglages={sansMigration as typeof reglages} />);
    expect(screen.getByRole("switch", { name: "Rappel du soir pour vider ma tête" })).toHaveAttribute("aria-checked", "false");
  });

  it("masque le champ d'heure quand le rappel est désactivé", () => {
    render(<VidageRow reglages={{ ...reglages, vidage_actif: false }} />);
    expect(screen.queryByLabelText("Heure du rappel")).toBeNull();
  });

  it("désactive le rappel avec l'heure courante", async () => {
    vi.mocked(updateReglagesVidage).mockResolvedValue({ ok: true, data: undefined });
    render(<VidageRow reglages={reglages} />);
    await userEvent.click(screen.getByRole("switch", { name: "Rappel du soir pour vider ma tête" }));
    await waitFor(() => expect(updateReglagesVidage).toHaveBeenCalledWith(false, "21:00"));
  });

  it("enregistre une nouvelle heure à la sortie du champ", async () => {
    vi.mocked(updateReglagesVidage).mockResolvedValue({ ok: true, data: undefined });
    render(<VidageRow reglages={reglages} />);
    const champ = screen.getByLabelText("Heure du rappel");
    fireEvent.change(champ, { target: { value: "22:15" } });
    fireEvent.blur(champ);
    await waitFor(() => expect(updateReglagesVidage).toHaveBeenCalledWith(true, "22:15"));
  });

  it("revient à l'état précédent et affiche l'erreur si l'enregistrement échoue", async () => {
    vi.mocked(updateReglagesVidage).mockResolvedValue({ ok: false, error: "Le réglage n'a pas pu être enregistré. Réessaie." });
    render(<VidageRow reglages={reglages} />);
    await userEvent.click(screen.getByRole("switch", { name: "Rappel du soir pour vider ma tête" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Le réglage n'a pas pu être enregistré");
    expect(screen.getByRole("switch", { name: "Rappel du soir pour vider ma tête" })).toHaveAttribute("aria-checked", "true");
  });
});
