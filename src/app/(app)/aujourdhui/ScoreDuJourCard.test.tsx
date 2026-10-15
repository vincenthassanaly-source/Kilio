import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScoreDuJourCard } from "./ScoreDuJourCard";
import { queryKeys } from "@/lib/query/keys";

// Les actions serveur ne sont jamais appelées : les caches sont amorcés.
vi.mock("@/app/actions/journal", () => ({ getResumeNutritionJour: vi.fn() }));
vi.mock("@/app/actions/habitudes", () => ({ getHabitudesDuJour: vi.fn() }));
vi.mock("@/app/actions/seances", () => ({ getSemaineSeances: vi.fn() }));

afterEach(() => cleanup());

const TODAY = "2026-10-15";

const RESUME = {
  consomme: { kcal: 1000, proteines: 80, glucides: 100, lipides: 30 },
  jourType: "repos",
  jourLibre: false,
  kcalGoal: 2000,
  macroGoals: { proteines: 150, glucides: 200, lipides: 60 },
};
const SEANCES = { groupes: [], seancesAujourdhui: 0 };
const JOURNAL_VIDE = { ...RESUME, consomme: { ...RESUME.consomme, kcal: 0 } };

function monter({
  taches = [{ fait: true }, { fait: false }],
  tachesChargent = false,
  resume = RESUME as typeof RESUME,
  seances = SEANCES,
  habitudes = [] as unknown[],
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(queryKeys.resumeNutrition(TODAY), resume);
  client.setQueryData(queryKeys.seancesSemaine(TODAY), seances);
  client.setQueryData(queryKeys.habitudes(TODAY), habitudes);
  return render(
    <QueryClientProvider client={client}>
      <ScoreDuJourCard today={TODAY} tachesDuJour={taches} tachesChargent={tachesChargent} />
    </QueryClientProvider>
  );
}

describe("ScoreDuJourCard", () => {
  it("affiche le score et le détail des domaines qui ont un objet", () => {
    monter();
    expect(screen.getByRole("heading", { name: "Score du jour" })).toBeTruthy();
    // (tâches 1/2 + nutrition 1000/2000) / 2 = 50 %
    expect(screen.getByText("50")).toBeTruthy();
    expect(screen.getByText("Tâches")).toBeTruthy();
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("Nutrition")).toBeTruthy();
    expect(screen.getByText("1000 / 2000 kcal")).toBeTruthy();
    expect(screen.queryByText("Sport")).toBeNull();
    expect(screen.queryByText("Habitudes")).toBeNull();
  });

  it("ajoute le sport un jour d'entraînement et les habitudes actives", () => {
    monter({
      resume: { ...RESUME, jourType: "entrainement" },
      seances: { groupes: [], seancesAujourdhui: 1 },
      habitudes: [
        { id: "h1", type: "boolean", valeur_cible: null, frequence_hebdo: null, entreeDuJour: { valeur: 1 } },
        { id: "h2", type: "boolean", valeur_cible: null, frequence_hebdo: null, entreeDuJour: null },
      ],
    });
    expect(screen.getByText("Séance faite")).toBeTruthy();
    expect(screen.getByText("Habitudes")).toBeTruthy();
    // Tâches (1/2) et habitudes (1/2) : deux lignes au même détail.
    expect(screen.getAllByText("1/2")).toHaveLength(2);
  });

  it("disparaît quand aucun domaine n'a d'objet", () => {
    const { container } = monter({ taches: [], resume: JOURNAL_VIDE });
    expect(container.querySelector("section")).toBeNull();
  });

  it("n'affiche pas la carte tant que les tâches chargent", () => {
    monter({ tachesChargent: true });
    expect(screen.queryByText("Score du jour")).toBeNull();
  });
});
