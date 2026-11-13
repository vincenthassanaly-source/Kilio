import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { reafficherElement } from "@/lib/actions/elementsMasques";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/components/BackLink", () => ({ BackLink: () => null }));
vi.mock("@/lib/musculation/useBrouillonEnCours", () => ({ useBrouillonEnCours: () => null }));
vi.mock("@/lib/musculation/demarrer", () => ({ demarrerDepuisRoutine: vi.fn(), demarrerDepuisEntrainement: vi.fn() }));
vi.mock("./seance/SelecteurExercices", () => ({ SelecteurExercices: () => null }));
vi.mock("@/app/actions/musculation", () => ({
  creerDossier: vi.fn(),
  renommerDossier: vi.fn(),
  supprimerDossier: vi.fn(),
  supprimerRoutine: vi.fn(),
  supprimerEntrainement: vi.fn(),
  enregistrerRoutine: vi.fn(),
  getRoutines: vi.fn(),
  getRoutine: vi.fn(),
  getEntrainement: vi.fn(),
  getEntrainements: vi.fn(),
}));

import {
  getEntrainement,
  getEntrainements,
  getRoutine,
  getRoutines,
  supprimerDossier,
  supprimerEntrainement,
  supprimerRoutine,
} from "@/app/actions/musculation";
import { DernieresSeances } from "./DernieresSeances";
import { RoutinesSection } from "./RoutinesSection";
import { RoutineEditeur } from "./routines/[id]/RoutineEditeur";
import { EntrainementDetailView } from "./historique/[id]/EntrainementDetailView";

function monter(ui: React.ReactElement) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  replace.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  reafficherElement("routine", "r1");
  reafficherElement("dossier-routines", "d1");
  reafficherElement("entrainement", "e1");
  vi.clearAllMocks();
});

const toastAnnuler = () => getToasts().find((t) => t.action);
async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("Routine : suppression avec annulation différée", () => {
  const ROUTINE = { id: "r1", nom: "Push A", typeSeance: null, dossierId: null, exercices: [] };

  async function supprimer() {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE as never);
    vi.mocked(getRoutines).mockResolvedValue({ dossiers: [], routines: [] } as never);
    vi.mocked(supprimerRoutine).mockResolvedValue({ ok: true, data: undefined } as never);
    monter(<RoutineEditeur routineId="r1" />);
    const bouton = await screen.findByRole("button", { name: "Supprimer la routine" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(bouton);
  }

  it("renvoie à la liste tout de suite, sans boîte de confirmation ni appel serveur", async () => {
    await supprimer();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/musculation");
    expect(supprimerRoutine).not.toHaveBeenCalled();
    expect(toastAnnuler()?.text).toBe("Routine « Push A » supprimée");
  });

  it("« Annuler » n'appelle jamais le serveur", async () => {
    await supprimer();
    act(() => toastAnnuler()?.action?.onAction());
    await avancer(10_000);
    expect(supprimerRoutine).not.toHaveBeenCalled();
  });

  it("supprime la routine après le délai", async () => {
    await supprimer();
    await avancer(6100);
    expect(supprimerRoutine).toHaveBeenCalledWith("r1");
  });
});

describe("Séance de l'historique : suppression avec annulation différée", () => {
  const DETAIL = {
    id: "e1",
    titre: "Push A",
    date: "2026-11-10",
    debutA: "2026-11-10T08:00:00Z",
    finA: "2026-11-10T09:00:00Z",
    dureeS: 3600,
    routineId: null,
    typeSeance: null,
    exercices: [],
  };

  async function supprimer() {
    vi.mocked(getEntrainement).mockResolvedValue(DETAIL as never);
    vi.mocked(supprimerEntrainement).mockResolvedValue({ ok: true, data: undefined } as never);
    monter(<EntrainementDetailView id="e1" />);
    const bouton = await screen.findByRole("button", { name: "Supprimer la séance" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(bouton);
  }

  it("renvoie à l'historique tout de suite, sans boîte de confirmation ni appel serveur", async () => {
    await supprimer();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/musculation/historique");
    expect(supprimerEntrainement).not.toHaveBeenCalled();
    expect(toastAnnuler()?.text).toMatch(/^Séance « Push A » du .* supprimée$/);
  });

  it("« Annuler » n'appelle jamais le serveur", async () => {
    await supprimer();
    act(() => toastAnnuler()?.action?.onAction());
    await avancer(10_000);
    expect(supprimerEntrainement).not.toHaveBeenCalled();
  });

  it("supprime la séance après le délai", async () => {
    await supprimer();
    await avancer(6100);
    expect(supprimerEntrainement).toHaveBeenCalledWith("e1");
  });

  it("la séance masquée disparaît des dernières séances, et revient si on annule", async () => {
    vi.mocked(getEntrainements).mockResolvedValue([
      { id: "e1", titre: "Push A", date: "2026-11-10", dureeS: 3600, typeSeance: null, nbExercices: 1, nbSeries: 3, volume: 0 },
    ] as never);
    monter(<DernieresSeances />);
    expect(await screen.findByText("Push A")).toBeInTheDocument();
    const { masquerElement } = await import("@/lib/actions/elementsMasques");
    act(() => masquerElement("entrainement", "e1"));
    await waitFor(() => expect(screen.queryByText("Push A")).not.toBeInTheDocument());
    act(() => reafficherElement("entrainement", "e1"));
    expect(await screen.findByText("Push A")).toBeInTheDocument();
  });
});

describe("Dossier de routines : suppression avec annulation différée", () => {
  const DONNEES = {
    dossiers: [{ id: "d1", nom: "Prise de masse" }],
    routines: [{ id: "r1", nom: "Push A", typeSeance: null, dossierId: "d1", nbExercices: 2 }],
  };

  async function supprimer() {
    vi.mocked(getRoutines).mockResolvedValue(DONNEES as never);
    vi.mocked(supprimerDossier).mockResolvedValue({ ok: true, data: undefined } as never);
    monter(<RoutinesSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Modifier le dossier Prise de masse" }));
    const bouton = await screen.findByRole("button", { name: "Supprimer le dossier" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(bouton);
  }

  it("retire le dossier tout de suite : ses routines passent « sans dossier », sans confirmation ni appel serveur", async () => {
    await supprimer();
    expect(screen.queryByRole("dialog", { name: /confirm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Dossier Prise de masse" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Routines sans dossier" })).toHaveTextContent("Push A");
    expect(supprimerDossier).not.toHaveBeenCalled();
    expect(toastAnnuler()?.text).toBe("Dossier « Prise de masse » supprimé · ses routines passent sans dossier");
  });

  it("« Annuler » remet le dossier et ses routines sans appel serveur", async () => {
    await supprimer();
    act(() => toastAnnuler()?.action?.onAction());
    expect(screen.getByRole("region", { name: "Dossier Prise de masse" })).toHaveTextContent("Push A");
    await avancer(10_000);
    expect(supprimerDossier).not.toHaveBeenCalled();
  });

  it("supprime le dossier après le délai", async () => {
    await supprimer();
    await avancer(6100);
    expect(supprimerDossier).toHaveBeenCalledWith("d1");
  });
});
