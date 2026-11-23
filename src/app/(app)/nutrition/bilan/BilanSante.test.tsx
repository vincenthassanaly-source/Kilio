import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/nutrition/bilan",
}));
vi.mock("@/app/actions/sante", () => ({
  getSyntheseSemaine: vi.fn(async () => ({})),
  getMesuresRecentes: vi.fn(async () => [
    { date: "2026-11-12", poids_kg: 82.4, tour_taille_cm: 91 },
    { date: "2026-11-05", poids_kg: 83, tour_taille_cm: null },
  ]),
  supprimerMesure: vi.fn(),
  enregistrerMesure: vi.fn(),
}));
vi.mock("./SyntheseSemaine", () => ({ SyntheseSemaine: () => <p>synthèse</p> }));

import { BilanSante } from "./BilanSante";

afterEach(() => {
  cleanup();
});

async function monter() {
  const element = await BilanSante();
  render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>);
}

describe("BilanSante", () => {
  it("propose la saisie compacte de la pesée dans le Bilan, sans renvoi vers Aujourd'hui", async () => {
    await monter();

    expect(screen.queryByRole("link", { name: "Peser" })).toBeNull();
    expect(screen.getByText("synthèse")).toBeInTheDocument();
    expect(screen.getByLabelText("Poids (kg)")).toBeInTheDocument();
    expect(screen.getByLabelText("Tour de taille (cm)")).toBeInTheDocument();
    // Compact : datée du jour, pas de champ de date.
    expect(screen.queryByLabelText("Date du relevé")).toBeNull();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
  });

  it("affiche la liste des derniers relevés avec leur suppression", async () => {
    await monter();

    const liste = screen.getByRole("list", { name: "Derniers relevés" });
    expect(liste.querySelectorAll("li")).toHaveLength(2);
    expect(liste).toHaveTextContent("82,4 kg · 91,0 cm");
    expect(liste).toHaveTextContent("83,0 kg");
    expect(screen.getAllByRole("button", { name: /^Supprimer le relevé du/ })).toHaveLength(2);
  });
});
