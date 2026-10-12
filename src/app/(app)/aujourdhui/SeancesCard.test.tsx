import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { composerSemaine, type EntrainementSemaine, type RoutineSemaine } from "@/lib/seances/compute";
import { SeancesCard } from "./SeancesCard";

const etat = vi.hoisted(() => ({ push: vi.fn(), enCours: null as { nom: string } | null }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: etat.push }) }));
vi.mock("@/app/actions/seances", () => ({ getSemaineSeances: vi.fn() }));
vi.mock("@/app/actions/musculation", () => ({ getRoutine: vi.fn() }));
vi.mock("@/lib/musculation/demarrer", () => ({ demarrerDepuisRoutine: vi.fn() }));
vi.mock("@/lib/musculation/useBrouillonEnCours", () => ({ useBrouillonEnCours: () => etat.enCours }));

import { getRoutine } from "@/app/actions/musculation";
import { getSemaineSeances } from "@/app/actions/seances";
import { demarrerDepuisRoutine } from "@/lib/musculation/demarrer";

afterEach(() => cleanup());

const TODAY = "2026-10-14";
const ROUTINES: RoutineSemaine[] = [
  { id: "ps-a", nom: "Push A", type: "PUSH", nbExercices: 5 },
  { id: "ps-b", nom: "Push B", type: "PUSH", nbExercices: 5 },
  { id: "pu-a", nom: "Pull A", type: "PULL", nbExercices: 5 },
  { id: "l-a", nom: "Legs A", type: "LEGS", nbExercices: 5 },
  { id: "l-b", nom: "Legs B", type: "LEGS", nbExercices: 0 },
];

async function monter(entrainements: EntrainementSemaine[] = []) {
  vi.mocked(getSemaineSeances).mockResolvedValue(composerSemaine(ROUTINES, entrainements));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SeancesCard today={TODAY} />
    </QueryClientProvider>
  );
  await screen.findByText("Legs");
}

const ligne = (type: string) => screen.getByText(type).closest("li") as HTMLElement;

describe("SeancesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    etat.enCours = null;
  });

  it("propose Push, Pull et Legs avec leurs pastilles, sans date ni heure", async () => {
    await monter();

    expect(screen.getByText("0/3 faites")).toBeTruthy();
    expect(["Push", "Pull", "Legs"].map((t) => ligne(t).getAttribute("data-faite"))).toEqual(["false", "false", "false"]);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["A", "B", "A", "A", "B"]);
    expect(screen.queryByText("Faite")).toBeNull();
    expect(screen.queryByText(/\d{2}:\d{2}/)).toBeNull();
  });

  it("montre quel type est fait : ligne marquée « Faite », les autres restent neutres", async () => {
    await monter([{ routine_id: "l-a", type_seance: "LEGS", date: "2026-10-13" }]);

    expect(screen.getByText("1/3 faites")).toBeTruthy();
    expect(ligne("Legs").getAttribute("data-faite")).toBe("true");
    expect(ligne("Legs").textContent).toContain("Faite");
    expect(ligne("Push").getAttribute("data-faite")).toBe("false");
    expect(ligne("Pull").getAttribute("data-faite")).toBe("false");
    expect(ligne("Push").textContent).not.toContain("Faite");
    expect(screen.getByRole("button", { name: "Commencer Legs A (déjà faite cette semaine)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Commencer Legs B" })).toBeTruthy();
  });

  it("une séance libre marque le type sans cocher de pastille", async () => {
    await monter([{ routine_id: null, type_seance: "PULL", date: "2026-10-13" }]);

    expect(ligne("Pull").getAttribute("data-faite")).toBe("true");
    expect(screen.getByRole("button", { name: "Commencer Pull A" })).toBeTruthy();
  });

  it("toucher une pastille démarre la routine et ouvre la séance", async () => {
    vi.mocked(getRoutine).mockResolvedValue({ id: "ps-a", nom: "Push A" } as never);
    vi.mocked(demarrerDepuisRoutine).mockResolvedValue({} as never);
    await monter();

    await userEvent.click(screen.getByRole("button", { name: "Commencer Push A" }));

    await waitFor(() => expect(etat.push).toHaveBeenCalledWith("/musculation/seance"));
    expect(getRoutine).toHaveBeenCalledWith("ps-a");
  });

  it("désactive les pastilles pendant une séance en cours et propose de la reprendre", async () => {
    etat.enCours = { nom: "Legs A" };
    await monter();

    expect(screen.getByRole("link", { name: /Séance en cours/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Commencer Push A" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("désactive une routine sans exercice", async () => {
    await monter();
    expect((screen.getByRole("button", { name: "Commencer Legs B" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
