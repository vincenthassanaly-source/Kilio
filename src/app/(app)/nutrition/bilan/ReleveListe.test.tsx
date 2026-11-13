import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReleveListe } from "./ReleveListe";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/sante", () => ({ supprimerMesure: vi.fn() }));

import { supprimerMesure } from "@/app/actions/sante";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";

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
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  for (const m of MESURES) reafficherElement("mesure", m.date);
});

describe("ReleveListe", () => {
  it("liste date, poids et tour de taille de chaque relevé, sans champ de saisie", () => {
    monter();
    const liste = screen.getByRole("list", { name: "Derniers relevés" });
    expect(liste).toHaveTextContent("82,4 kg · 91,0 cm");
    expect(liste).toHaveTextContent("92,5 cm");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  function supprimerSecond() {
    vi.mocked(supprimerMesure).mockResolvedValue({ ok: true, data: undefined } as never);
    monter();
    fireEvent.click(screen.getAllByRole("button", { name: /^Supprimer le relevé du/ })[1]);
  }

  it("retire le relevé tout de suite, sans boîte de confirmation ni appel serveur, et propose « Annuler »", () => {
    supprimerSecond();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(supprimerMesure).not.toHaveBeenCalled();
    const toast = getToasts().find((t) => t.action);
    expect(toast?.text).toMatch(/^Relevé du .* supprimé$/);
    expect(toast?.action?.label).toBe("Annuler");
  });

  it("« Annuler » remet le relevé sans appel serveur", async () => {
    supprimerSecond();
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(supprimerMesure).not.toHaveBeenCalled();
  });

  it("supprime le relevé choisi, par sa date, après le délai", async () => {
    supprimerSecond();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6100);
    });
    expect(supprimerMesure).toHaveBeenCalledWith("2026-11-05");
  });

  it("n'affiche rien sans relevé", () => {
    monter([]);
    expect(screen.queryByRole("list")).toBeNull();
  });
});
