import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TachePropose } from "@/lib/taches/saisie-naturelle";

vi.mock("@/app/actions/saisie-taches", () => ({
  analyserSaisieTaches: vi.fn(),
  creerTachesProposees: vi.fn(),
  preparerListe: vi.fn(),
}));
vi.mock("@/app/actions/taches", () => ({
  getListes: vi.fn().mockResolvedValue([]),
  getTags: vi.fn().mockResolvedValue([]),
}));
// Le formulaire complet (chargé à la demande) n'est pas l'objet de ce test.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/toast/toast-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/toast/toast-store")>();
  return { ...actual, showToast: vi.fn(), showErrorToast: vi.fn() };
});

import { analyserSaisieTaches, creerTachesProposees } from "@/app/actions/saisie-taches";
import { showToast } from "@/components/toast/toast-store";
import { DashboardSaisieIACard } from "./DashboardSaisieIACard";

const analyser = vi.mocked(analyserSaisieTaches);
const creer = vi.mocked(creerTachesProposees);

function tache(surcharge: Partial<TachePropose> = {}): TachePropose {
  return {
    titre: "Rendez-vous dentiste",
    echeance: "2026-10-08",
    heure: "14:00",
    heure_fin: null,
    toute_la_journee: false,
    priorite: "haute",
    rappel_minutes: 1440,
    recurrence_frequence: null,
    recurrence_fin: null,
    listeId: "l-perso",
    nouvelleListe: null,
    listeNom: "Perso",
    tagIds: [],
    nouveauxTags: [],
    tagNoms: [],
    avertissements: [],
    ...surcharge,
  };
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DashboardSaisieIACard />
    </QueryClientProvider>
  );
  return userEvent.setup();
}

async function saisir(user: ReturnType<typeof userEvent.setup>, texte: string) {
  await user.click(screen.getByRole("button", { name: /Ajouter avec l'IA/ }));
  await user.type(screen.getByLabelText("Décris la ou les tâches à ajouter"), texte);
  await user.click(screen.getByRole("button", { name: "Analyser" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Vitest tourne sans globals : RTL ne nettoie pas seul entre deux tests.
afterEach(() => {
  cleanup();
});

describe("DashboardSaisieIACard", () => {
  it("affiche l'aperçu, crée seulement les tâches retenues puis se referme", async () => {
    analyser.mockResolvedValue({
      ok: true,
      data: {
        statut: "taches",
        taches: [tache(), tache({ titre: "Acheter du pain", heure: null, rappel_minutes: null, priorite: "aucune" })],
      },
    });
    creer.mockResolvedValue({ ok: true, data: [{ index: 0, ok: true, id: "t1" }] });
    const user = afficher();

    await saisir(user, "dentiste et pain");
    expect(await screen.findByRole("button", { name: "Créer 2 tâches" })).toBeInTheDocument();
    expect(screen.getByText("Rappel : la veille")).toBeInTheDocument();
    expect(analyser).toHaveBeenCalledWith("dentiste et pain", []);

    await user.click(screen.getByRole("button", { name: "Créer « Acheter du pain »" }));
    await user.click(screen.getByRole("button", { name: "Créer la tâche" }));

    await waitFor(() => expect(creer).toHaveBeenCalledTimes(1));
    const envoyees = creer.mock.calls[0][0];
    expect(envoyees).toHaveLength(1);
    expect(envoyees[0]).toMatchObject({
      titre: "Rendez-vous dentiste",
      echeance: "2026-10-08",
      heure: "14:00",
      rappel_minutes: 1440,
      priorite: "haute",
      listeId: "l-perso",
    });
    // Rien d'autre que les champs de création ne transite vers le serveur.
    expect(envoyees[0]).not.toHaveProperty("avertissements");
    expect(envoyees[0]).not.toHaveProperty("listeNom");

    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Tâche créée"));
    expect(screen.getByRole("button", { name: /Ajouter avec l'IA/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("pose la question de précision puis renvoie la réponse avec le texte d'origine", async () => {
    analyser
      .mockResolvedValueOnce({ ok: true, data: { statut: "question", question: "Quel jeudi ?", choix: ["Aujourd'hui", "Jeudi prochain"] } })
      .mockResolvedValueOnce({ ok: true, data: { statut: "taches", taches: [tache({ titre: "Réunion" })] } });
    const user = afficher();

    await saisir(user, "réunion jeudi 10h");
    expect(await screen.findByText("Quel jeudi ?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Jeudi prochain" }));

    expect(await screen.findByRole("button", { name: "Créer la tâche" })).toBeInTheDocument();
    expect(analyser).toHaveBeenLastCalledWith("réunion jeudi 10h", [
      { question: "Quel jeudi ?", reponse: "Jeudi prochain" },
    ]);
  });

  it("accepte une réponse libre à la question", async () => {
    analyser
      .mockResolvedValueOnce({ ok: true, data: { statut: "question", question: "Quel titre ?", choix: [] } })
      .mockResolvedValueOnce({ ok: true, data: { statut: "taches", taches: [tache()] } });
    const user = afficher();

    await saisir(user, "demain 9h");
    await screen.findByText("Quel titre ?");
    await user.type(screen.getByLabelText("Autre réponse"), "Appeler Paul");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await screen.findByRole("button", { name: "Créer la tâche" });
    expect(analyser).toHaveBeenLastCalledWith("demain 9h", [{ question: "Quel titre ?", reponse: "Appeler Paul" }]);
  });

  it("quota atteint : garde le texte et propose la création simple", async () => {
    analyser.mockResolvedValue({
      ok: true,
      data: { statut: "erreur", code: "quota", message: "Le quota gratuit de Gemini est atteint pour le moment. Réessaie plus tard." },
    });
    const user = afficher();

    await saisir(user, "dentiste jeudi");
    expect(await screen.findByText(/quota gratuit de Gemini est atteint/)).toBeInTheDocument();
    expect(screen.getByText(/Ton texte est conservé : « dentiste jeudi »/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer une tâche simple avec ce texte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Modifier mon texte" }));
    expect(screen.getByLabelText("Décris la ou les tâches à ajouter")).toHaveValue("dentiste jeudi");
  });

  it("texte incompris : pas de « Réessayer » inutile", async () => {
    analyser.mockResolvedValue({
      ok: true,
      data: { statut: "erreur", code: "incomprehensible", message: "Je n'ai pas trouvé de tâche dans ce texte." },
    });
    const user = afficher();

    await saisir(user, "bof");
    await screen.findByText(/Je n'ai pas trouvé de tâche/);
    expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer une tâche simple avec ce texte" })).toBeInTheDocument();
  });

  it("échec réseau de l'analyse : message d'erreur, texte conservé", async () => {
    analyser.mockResolvedValue({ ok: false, error: "Pas de connexion : rien n'a été enregistré. Réessaie une fois en ligne." });
    const user = afficher();

    await saisir(user, "pain demain");
    expect(await screen.findByText(/Pas de connexion/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("échec partiel : la tâche en échec reste dans l'aperçu avec sa raison", async () => {
    analyser.mockResolvedValue({
      ok: true,
      data: { statut: "taches", taches: [tache(), tache({ titre: "Acheter du pain" })] },
    });
    creer.mockResolvedValue({
      ok: true,
      data: [
        { index: 0, ok: true, id: "t1" },
        { index: 1, ok: false, message: "Liste introuvable." },
      ],
    });
    const user = afficher();

    await saisir(user, "deux choses");
    await user.click(await screen.findByRole("button", { name: "Créer 2 tâches" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Liste introuvable.");
    expect(screen.getByText("Acheter du pain")).toBeInTheDocument();
    expect(screen.queryByText("Rendez-vous dentiste")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Tâche créée");
    expect(screen.getByRole("button", { name: /Ajouter avec l'IA/ })).toHaveAttribute("aria-expanded", "true");
  });
});
