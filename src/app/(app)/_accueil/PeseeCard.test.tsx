import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PeseeCard } from "./PeseeCard";

let paramsMock = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => paramsMock,
}));
vi.mock("@/app/actions/sante", () => ({
  getMesuresRecentes: vi.fn(),
  enregistrerMesure: vi.fn(),
  supprimerMesure: vi.fn(),
}));

import { getMesuresRecentes } from "@/app/actions/sante";

const TODAY = "2026-11-13";
const releve = (date: string) => ({ date, poids_kg: 82, tour_taille_cm: null });

function monter() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PeseeCard today={TODAY} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  paramsMock = new URLSearchParams();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("PeseeCard", () => {
  it("reste masquée tant qu'un relevé de moins de 7 jours existe", async () => {
    vi.mocked(getMesuresRecentes).mockResolvedValue([releve("2026-11-11")] as never);
    monter();
    await vi.waitFor(() => expect(getMesuresRecentes).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole("region", { name: "Pesée de la semaine" })).toBeNull();
  });

  it("s'affiche quand le dernier relevé a plus de 7 jours", async () => {
    vi.mocked(getMesuresRecentes).mockResolvedValue([releve("2026-11-01")] as never);
    monter();
    expect(await screen.findByRole("region", { name: "Pesée de la semaine" })).toBeInTheDocument();
    expect(screen.getByText(/Dernier relevé il y a 12 jours/)).toBeInTheDocument();
  });

  it("s'affiche aussi avec ?peser=1 (lien « Peser » du Bilan) malgré un relevé récent, et se met en vue", async () => {
    paramsMock = new URLSearchParams("peser=1");
    vi.mocked(getMesuresRecentes).mockResolvedValue([releve("2026-11-12")] as never);
    monter();
    expect(await screen.findByRole("region", { name: "Pesée de la semaine" })).toBeInTheDocument();
    expect(screen.getByText(/Nouveau relevé/)).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
