import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReleveListe } from "./ReleveListe";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/sante", () => ({ supprimerMesure: vi.fn() }));
vi.mock("@/lib/confirm", () => ({ confirmDelete: vi.fn() }));

import { supprimerMesure } from "@/app/actions/sante";
import { confirmDelete } from "@/lib/confirm";

const MESURES = [
  { date: "2026-11-12", poids_kg: 82.4, tour_taille_cm: 91 },
  { date: "2026-11-05", poids_kg: null, tour_taille_cm: 92.5 },
];

function monter(mesures = MESURES) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReleveListe mesures={mesures} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("ReleveListe", () => {
  it("liste date, poids et tour de taille de chaque relevé, sans champ de saisie", () => {
    monter();
    const liste = screen.getByRole("list", { name: "Derniers relevés" });
    expect(liste).toHaveTextContent("82,4 kg · 91,0 cm");
    expect(liste).toHaveTextContent("92,5 cm");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("supprime le relevé choisi, par sa date, après confirmation", async () => {
    vi.mocked(confirmDelete).mockResolvedValue(true);
    vi.mocked(supprimerMesure).mockResolvedValue({ ok: true, data: undefined } as never);
    monter();

    await userEvent.click(screen.getAllByRole("button", { name: /^Supprimer le relevé du/ })[1]);

    await vi.waitFor(() => expect(supprimerMesure).toHaveBeenCalledWith("2026-11-05"));
    expect(confirmDelete).toHaveBeenCalledTimes(1);
  });

  it("ne supprime rien si la confirmation est refusée", async () => {
    vi.mocked(confirmDelete).mockResolvedValue(false);
    monter();

    await userEvent.click(screen.getAllByRole("button", { name: /^Supprimer le relevé du/ })[0]);

    expect(supprimerMesure).not.toHaveBeenCalled();
  });

  it("n'affiche rien sans relevé", () => {
    monter([]);
    expect(screen.queryByRole("list")).toBeNull();
  });
});
