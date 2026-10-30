import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SaisieNaturelle } from "./SaisieNaturelle";
import { normaliserReponse, type ElementSaisie } from "@/lib/saisie/compute";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

vi.mock("@/app/actions/saisie", () => ({ interpreterSaisie: vi.fn() }));
vi.mock("@/app/actions/taches", () => ({
  createTache: vi.fn(),
  createSousTache: vi.fn(),
  getListes: vi.fn(async () => [
    { id: "l-general", nom: "Général" },
    { id: "l-maison", nom: "Maison" },
  ]),
}));
vi.mock("@/app/actions/evenements", () => ({ createEvenement: vi.fn() }));

import { interpreterSaisie } from "@/app/actions/saisie";
import { createSousTache, createTache } from "@/app/actions/taches";
import { createEvenement } from "@/app/actions/evenements";

const CTX = {
  aujourdhui: "2026-10-30",
  heure: "10:00",
  listes: [
    { id: "l-general", nom: "Général" },
    { id: "l-maison", nom: "Maison" },
  ],
  tags: [],
};

function elements(...bruts: Record<string, unknown>[]): ElementSaisie[] {
  const base = {
    type: "tache",
    titre: "x",
    date: "",
    heure: "",
    heure_proposee: false,
    toute_la_journee: false,
    duree_minutes: 0,
    liste_id: "",
    tags: [],
    nouveaux_tags: [],
    sous_taches: [],
    rappel_demande: false,
    rappel_delai_minutes: 0,
    recurrence: "aucune",
    recurrence_fin: "",
    notes: "",
  };
  return normaliserReponse({ elements: bruts.map((b) => ({ ...base, ...b })) }, CTX)!;
}

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SaisieNaturelle />
    </QueryClientProvider>
  );
}

async function saisir(texte: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Ajouter une tâche ou un événement/), texte);
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe("SaisieNaturelle", () => {
  it("n'appelle pas Gemini tant que rien n'est soumis", () => {
    rendre();
    expect(interpreterSaisie).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeDisabled();
  });

  it("affiche l'erreur de l'interprétation et garde le texte", async () => {
    vi.mocked(interpreterSaisie).mockResolvedValue({ ok: false, error: "Le quota gratuit de Gemini est atteint." });
    rendre();
    await saisir("dentiste jeudi");
    expect(await screen.findByRole("alert")).toHaveTextContent("quota");
    expect(screen.getByLabelText(/Ajouter une tâche ou un événement/)).toHaveValue("dentiste jeudi");
  });

  it("aperçu : rien n'est créé avant Valider, puis une tâche avec sous-tâche et un événement sont créés", async () => {
    vi.mocked(interpreterSaisie).mockResolvedValue({
      ok: true,
      data: elements(
        { titre: "Préparer le voyage", date: "2026-11-05", heure: "10:00", sous_taches: ["valises"], liste_id: "l-maison" },
        { type: "evenement", titre: "Dentiste", date: "2026-11-06", heure: "14:30" }
      ),
    });
    vi.mocked(createTache).mockResolvedValue({ error: null, id: "t1" });
    vi.mocked(createSousTache).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(createEvenement).mockResolvedValue({ ok: true, data: { id: "e1" } });

    rendre();
    const user = await saisir("voyage et dentiste");
    expect(await screen.findByText(/rien n.est ajouté avant/i)).toBeInTheDocument();
    expect(createTache).not.toHaveBeenCalled();
    expect(screen.getByText("déduite")).toBeInTheDocument();
    expect(screen.getAllByText("par défaut").length).toBe(2);

    await user.click(screen.getByRole("button", { name: "Valider (2)" }));
    await waitFor(() => expect(createEvenement).toHaveBeenCalledTimes(1));

    const formData = vi.mocked(createTache).mock.calls[0][1] as FormData;
    expect(formData.get("titre")).toBe("Préparer le voyage");
    expect(formData.get("liste_id")).toBe("l-maison");
    expect(formData.get("rappel_minutes")).toBe("0");
    expect(createSousTache).toHaveBeenCalledWith("t1", "valises");
    expect(vi.mocked(createEvenement).mock.calls[0][0]).toMatchObject({
      titre: "Dentiste",
      date: "2026-11-06",
      heure: "14:30",
      rappelMinutes: 0,
    });
    await waitFor(() => expect(screen.queryByText(/rien n.est ajouté avant/i)).not.toBeInTheDocument());
    expect(screen.getByLabelText(/Ajouter une tâche ou un événement/)).toHaveValue("");
  });

  it("un échec garde l'élément en erreur dans l'aperçu sans recréer les autres", async () => {
    vi.mocked(interpreterSaisie).mockResolvedValue({
      ok: true,
      data: elements({ titre: "A", date: "2026-11-05" }, { titre: "B", date: "2026-11-06" }),
    });
    vi.mocked(createTache)
      .mockResolvedValueOnce({ error: null, id: "t1" })
      .mockResolvedValueOnce({ error: "Base indisponible." });

    rendre();
    const user = await saisir("a et b");
    await user.click(await screen.findByRole("button", { name: "Valider (2)" }));

    expect(await screen.findByText("Base indisponible.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("B")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("A")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Ajouter une tâche ou un événement/)).toHaveValue("a et b");
  });

  it("événement sans date : bloqué avec un message, sans appel de création", async () => {
    vi.mocked(interpreterSaisie).mockResolvedValue({
      ok: true,
      data: elements({ type: "evenement", titre: "Réunion", heure: "10:00" }),
    });
    rendre();
    const user = await saisir("réunion");
    await user.click(await screen.findByRole("button", { name: "Valider" }));
    expect(await screen.findByText("La date est requise pour un événement.")).toBeInTheDocument();
    expect(createEvenement).not.toHaveBeenCalled();
  });

  it("Annuler ferme l'aperçu et conserve le texte", async () => {
    vi.mocked(interpreterSaisie).mockResolvedValue({ ok: true, data: elements({ titre: "A" }) });
    rendre();
    const user = await saisir("a");
    await user.click(await screen.findByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByText(/rien n.est ajouté avant/i)).not.toBeInTheDocument());
    expect(screen.getByLabelText(/Ajouter une tâche ou un événement/)).toHaveValue("a");
  });
});
