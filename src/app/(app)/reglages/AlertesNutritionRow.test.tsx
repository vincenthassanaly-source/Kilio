import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AlertesNutritionRow } from "./AlertesNutritionRow";

vi.mock("@/app/actions/briefing", () => ({
  updateReglageAlerteKcal: vi.fn(),
  updateReglagesRappelSaisie: vi.fn(),
}));

afterEach(() => cleanup());

const reglages = {
  id: 1,
  alerte_kcal_actif: true,
  alerte_kcal_dernier_envoi: null,
  rappel_saisie_actif: true,
  rappel_saisie_heure: "19:45:00",
  rappel_saisie_dernier_envoi: null,
  updated_at: "2026-10-19T00:00:00Z",
} as never;

describe("AlertesNutritionRow", () => {
  it("affiche l'heure du rappel de saisie réglée (secondes retirées)", () => {
    render(<AlertesNutritionRow reglages={reglages} />);

    expect((screen.getByLabelText(/Heure/i) as HTMLInputElement).value).toBe("19:45");
  });

  it("ne fait pas tomber Réglages quand l'heure du rappel manque : repli sur 20:00", () => {
    const sansHeure = { ...(reglages as object), rappel_saisie_heure: undefined } as never;

    render(<AlertesNutritionRow reglages={sansHeure} />);

    expect((screen.getByLabelText(/Heure/i) as HTMLInputElement).value).toBe("20:00");
  });
});
