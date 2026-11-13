import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PeseeForm } from "./PeseeForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/sante", () => ({
  enregistrerMesure: vi.fn(),
  supprimerMesure: vi.fn(),
}));

import { enregistrerMesure } from "@/app/actions/sante";

afterEach(() => {
  cleanup();
});

function monter() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <PeseeForm today="2026-11-13" mesures={[]} compact />
    </QueryClientProvider>
  );
}

describe("PeseeForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dit la plage et le format attendus quand le poids est illisible, sans appeler le serveur", async () => {
    monter();
    await userEvent.type(screen.getByLabelText("Poids (kg)"), "quatre-vingts");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    const alerte = (await screen.findByRole("alert")).textContent ?? "";
    expect(alerte).toContain("30 et 300 kg");
    expect(alerte).toContain("virgule ou un point");
    expect(enregistrerMesure).not.toHaveBeenCalled();
  });

  it("dit la plage et le format attendus quand le tour de taille est illisible", async () => {
    monter();
    await userEvent.type(screen.getByLabelText("Tour de taille (cm)"), "91,5,2");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    const alerte = (await screen.findByRole("alert")).textContent ?? "";
    expect(alerte).toContain("40 et 250 cm");
    expect(alerte).toContain("virgule ou un point");
    expect(enregistrerMesure).not.toHaveBeenCalled();
  });

  it("accepte la virgule décimale et envoie le poids au serveur", async () => {
    vi.mocked(enregistrerMesure).mockResolvedValue({ ok: true, data: undefined } as never);
    monter();
    await userEvent.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() =>
      expect(enregistrerMesure).toHaveBeenCalledWith({ date: "2026-11-13", poidsKg: 82.4, tourTailleCm: null })
    );
  });
});
