import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RevueView } from "./RevueView";
import { queryKeys } from "@/lib/query/keys";
import { makeTache } from "@/test/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/revue",
  useSearchParams: () => new URLSearchParams(),
}));
// Compteur de l'inbox : route GET /api/inbox/count.
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 3 }) })
);
vi.mock("@/app/actions/evenements", () => ({ getEvenements: vi.fn().mockResolvedValue([]) }));
vi.mock("@/app/actions/taches", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/actions/taches")>()),
  getTachesAvecRelations: vi.fn().mockResolvedValue([]),
}));

afterEach(() => cleanup());

const TODAY = "2026-10-11"; // dimanche

function monter(taches = [makeTache({ id: "a" })], evenementsAvenir: unknown[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(queryKeys.taches, taches);
  client.setQueryData(queryKeys.evenementsPlage("2026-10-05", TODAY), []);
  client.setQueryData(queryKeys.evenementsPlage("2026-10-12", "2026-10-18"), evenementsAvenir);
  render(
    <QueryClientProvider client={client}>
      <RevueView today={TODAY} />
    </QueryClientProvider>
  );
}

describe("RevueView", () => {
  it("affiche le bilan, les retards et les 7 prochains jours", () => {
    monter([
      makeTache({ id: "t1", titre: "Fini hier", fait: true, termine_le: "2026-10-10T09:00:00Z" }),
      makeTache({ id: "t2", titre: "Facture en retard", echeance: "2026-10-07" }),
      makeTache({ id: "t3", titre: "Lundi matin", echeance: "2026-10-12" }),
      makeTache({ id: "t4", titre: "Sans date" }),
    ]);
    expect(screen.getByText("1. Bilan des 7 derniers jours")).toBeTruthy();
    expect(screen.getByText("✓ Fini hier")).toBeTruthy();
    expect(screen.getByText("Facture en retard")).toBeTruthy();
    expect(screen.getByText("☐ Lundi matin")).toBeTruthy();
    expect(screen.getAllByText("Libre")).toHaveLength(6);
    expect(screen.getByText(/1 tâche n'a pas d'échéance/)).toBeTruthy();
  });

  it("félicite quand rien n'est en retard", () => {
    monter([makeTache({ id: "t1", echeance: "2026-10-13" })]);
    expect(screen.getByText("Rien en retard. Bien joué.")).toBeTruthy();
  });

  it("liste les événements à venir, journée entière comprise", () => {
    monter([], [
      { id: "e1", titre: "Dentiste", date: "2026-10-14", heure: "14:00:00", heure_fin: "15:00:00", toute_la_journee: false },
      { id: "e2", titre: "Anniv Léa", date: "2026-10-14", heure: "00:00:00", heure_fin: "23:59:00", toute_la_journee: true },
    ]);
    expect(screen.getByText("Dentiste")).toBeTruthy();
    expect(screen.getByText("Anniv Léa")).toBeTruthy();
    expect(screen.getByText("Journée")).toBeTruthy();
  });

  it("propose de trier l'inbox quand elle n'est pas vide", async () => {
    monter([makeTache({ id: "t1" })]);
    await waitFor(() => expect(screen.getByText("4. Inbox à trier")).toBeTruthy());
    expect(screen.getByText(/3 éléments à trier/)).toBeTruthy();
  });
});
