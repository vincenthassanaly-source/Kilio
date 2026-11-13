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
  it("consulte seulement : un lien « Peser » mène à la carte d'Aujourd'hui, sans formulaire de saisie", async () => {
    await monter();

    expect(screen.getByRole("link", { name: "Peser" })).toHaveAttribute("href", "/?peser=1");
    expect(screen.getByText("synthèse")).toBeInTheDocument();
    expect(screen.queryByLabelText("Poids (kg)")).toBeNull();
    expect(screen.queryByLabelText("Tour de taille (cm)")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
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
