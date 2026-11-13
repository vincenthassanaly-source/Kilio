import { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/actions/huiles", () => ({ supprimerHuile: vi.fn(), getHuilesSnapshot: vi.fn() }));
vi.mock("@/lib/pharmacie/cache", () => ({ enregistrerHuilesLocal: vi.fn(), lireHuilesLocal: vi.fn() }));
vi.mock("@/components/BackLink", () => ({ BackLink: () => null }));
vi.mock("../HuileEditeur", () => ({ HuileEditeur: () => null }));

import { getHuilesSnapshot, supprimerHuile } from "@/app/actions/huiles";
import FichePage from "./page";

const HUILE = {
  id: "h1",
  nom_fr: "Lavande vraie",
  nom_latin: null,
  famille: null,
  partie_distillee: null,
  chemotype: null,
  dermocaustique: false,
  photosensibilisante: false,
  precautions: [],
  precautions_details: null,
  voies: [],
  indications: [],
  proprietes: [],
  dosage: null,
  mode_emploi: null,
  notes: null,
  sources: null,
};

async function monter() {
  vi.mocked(getHuilesSnapshot).mockResolvedValue({ huiles: [HUILE], genereLe: "2026-11-13T00:00:00Z" } as never);
  vi.mocked(supprimerHuile).mockResolvedValue({ ok: true, data: undefined });
  const params = Promise.resolve({ huileId: "h1" });
  await act(async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Suspense fallback={null}>
          <FichePage params={params} />
        </Suspense>
      </QueryClientProvider>
    );
  });
  const bouton = await screen.findByRole("button", { name: "Supprimer" });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fireEvent.click(bouton);
}

beforeEach(() => {
  push.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("huile", "h1");
  vi.clearAllMocks();
});

async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("Fiche d'une huile essentielle : suppression avec annulation différée", () => {
  it("renvoie à la liste tout de suite, sans étape « Confirmer » ni appel serveur", async () => {
    await monter();
    expect(screen.queryByRole("button", { name: "Confirmer la suppression" })).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/pharmacie/huiles-essentielles");
    expect(supprimerHuile).not.toHaveBeenCalled();
    expect(getToasts().find((t) => t.action)?.text).toBe("Huile « Lavande vraie » supprimée avec ses cartes de révision");
  });

  it("« Annuler » n'appelle jamais le serveur", async () => {
    await monter();
    act(() => getToasts().find((t) => t.action)?.action?.onAction());
    await avancer(10_000);
    expect(supprimerHuile).not.toHaveBeenCalled();
  });

  it("supprime l'huile après le délai", async () => {
    await monter();
    await avancer(6100);
    expect(supprimerHuile).toHaveBeenCalledWith("h1");
  });
});
