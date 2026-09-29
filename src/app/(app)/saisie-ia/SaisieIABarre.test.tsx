import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ElementPropose } from "@/lib/saisie-ia/types";
import type { TachePropose } from "@/lib/taches/saisie-naturelle";

vi.mock("@/app/actions/saisie-ia", () => ({
  analyserSaisie: vi.fn(),
  creerElementsProposes: vi.fn(),
}));
vi.mock("@/app/actions/saisie-taches", () => ({ preparerListe: vi.fn() }));
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

import { analyserSaisie, creerElementsProposes } from "@/app/actions/saisie-ia";
import { showToast } from "@/components/toast/toast-store";
import { SaisieIABarre } from "./SaisieIABarre";

const analyser = vi.mocked(analyserSaisie);
const creer = vi.mocked(creerElementsProposes);

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

function element(surcharge: Partial<TachePropose> = {}): ElementPropose {
  return { type: "tache", donnees: tache(surcharge) };
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SaisieIABarre />
    </QueryClientProvider>
  );
  return userEvent.setup();
}

async function saisir(user: ReturnType<typeof userEvent.setup>, texte: string) {
  await user.click(screen.getByRole("button", { name: /Ajouter avec l'IA/ }));
  await user.type(screen.getByLabelText("Décris ce que tu veux ajouter"), texte);
  await user.click(screen.getByRole("button", { name: "Analyser" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Vitest tourne sans globals : RTL ne nettoie pas seul entre deux tests.
afterEach(() => {
  cleanup();
});

describe("SaisieIABarre", () => {
  it("affiche l'aperçu, crée seulement les tâches retenues puis se referme", async () => {
    analyser.mockResolvedValue({
      ok: true,
      data: {
        statut: "elements",
        elements: [element(), element({ titre: "Acheter du pain", heure: null, rappel_minutes: null, priorite: "aucune" })],
      },
    });
    creer.mockResolvedValue({ ok: true, data: [{ index: 0, ok: true }] });
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
    expect(envoyees[0]).toMatchObject({ type: "tache" });
    expect(envoyees[0].donnees).toMatchObject({
      titre: "Rendez-vous dentiste",
      echeance: "2026-10-08",
      heure: "14:00",
      rappel_minutes: 1440,
      priorite: "haute",
      listeId: "l-perso",
    });
    // Rien d'autre que les champs de création ne transite vers le serveur.
    expect(envoyees[0].donnees).not.toHaveProperty("avertissements");
    expect(envoyees[0].donnees).not.toHaveProperty("listeNom");

    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Tâche créée"));
    expect(screen.getByRole("button", { name: /Ajouter avec l'IA/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("pose la question de précision puis renvoie la réponse avec le texte d'origine", async () => {
    analyser
      .mockResolvedValueOnce({ ok: true, data: { statut: "question", question: "Quel jeudi ?", choix: ["Aujourd'hui", "Jeudi prochain"] } })
      .mockResolvedValueOnce({ ok: true, data: { statut: "elements", elements: [element({ titre: "Réunion" })] } });
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
      .mockResolvedValueOnce({ ok: true, data: { statut: "elements", elements: [element()] } });
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
    expect(screen.getByLabelText("Décris ce que tu veux ajouter")).toHaveValue("dentiste jeudi");
  });

  it("échec de Gemini : affiche la cause technique sous le message", async () => {
    analyser.mockResolvedValue({
      ok: true,
      data: {
        statut: "erreur",
        code: "echec",
        message: "L'analyse a échoué. Réessaie.",
        detail: "Gemini a répondu 400 : Unknown name \"nullable\"",
      },
    });
    const user = afficher();

    await saisir(user, "colis demain");
    expect(await screen.findByText("L'analyse a échoué. Réessaie.")).toBeInTheDocument();
    expect(screen.getByText(/Détail : Gemini a répondu 400/)).toBeInTheDocument();
  });

  it("le serveur ne répond pas correctement : le dit au lieu d'un message muet", async () => {
    // runAction renvoie son message de repli quand l'appel lui-même lève.
    analyser.mockRejectedValue(new Error("An unexpected response was received from the server."));
    const user = afficher();

    await saisir(user, "colis demain");
    expect(await screen.findByText("L'analyse a échoué. Réessaie.")).toBeInTheDocument();
    expect(screen.getByText(/Le serveur n'a pas répondu correctement/)).toBeInTheDocument();
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
      data: { statut: "elements", elements: [element(), element({ titre: "Acheter du pain" })] },
    });
    creer.mockResolvedValue({
      ok: true,
      data: [
        { index: 0, ok: true },
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

  describe("plusieurs modules", () => {
    const course = (libelle: string, avertissements: string[] = []): ElementPropose => ({
      type: "course",
      donnees: { libelle, avertissements },
    });
    const note = (titre: string): ElementPropose => ({
      type: "note",
      donnees: {
        titre,
        type: "texte",
        contenu: "Un livre de cuisine",
        items: [],
        tagIds: [],
        nouveauxTags: [],
        tagNoms: ["idées"],
        avertissements: [],
      },
    });

    it("mêle tâches, courses et notes : libellés neutres, un type par ligne, envoi typé", async () => {
      analyser.mockResolvedValue({
        ok: true,
        data: {
          statut: "elements",
          elements: [element(), course("Lait", ["Déjà dans la liste : ne sera pas ajouté une seconde fois."]), note("Idée cadeau")],
        },
      });
      creer.mockResolvedValue({ ok: true, data: [{ index: 0, ok: true }, { index: 1, ok: true }, { index: 2, ok: true }] });
      const user = afficher();

      await saisir(user, "dentiste, lait, idée cadeau");
      await user.click(await screen.findByRole("button", { name: "Créer 3 éléments" }));

      await waitFor(() => expect(creer).toHaveBeenCalledTimes(1));
      expect(creer.mock.calls[0][0].map((e) => e.type)).toEqual(["tache", "course", "note"]);
      expect(creer.mock.calls[0][0][1]).toEqual({
        type: "course",
        donnees: { libelle: "Lait", avertissements: ["Déjà dans la liste : ne sera pas ajouté une seconde fois."] },
      });
      await waitFor(() => expect(showToast).toHaveBeenCalledWith("3 éléments créés"));
    });

    it("affiche le détail propre à chaque type (avertissement de course, pastilles de note)", async () => {
      analyser.mockResolvedValue({
        ok: true,
        data: {
          statut: "elements",
          elements: [course("Lait", ["Déjà dans la liste : ne sera pas ajouté une seconde fois."]), note("Idée cadeau")],
        },
      });
      const user = afficher();

      await saisir(user, "lait, idée cadeau");

      expect(await screen.findByText("Déjà dans la liste : ne sera pas ajouté une seconde fois.")).toBeInTheDocument();
      expect(screen.getByText("Un livre de cuisine")).toBeInTheDocument();
      expect(screen.getByText("#idées")).toBeInTheDocument();
    });

    it("changer le type d'une ligne refait la proposition à partir de son titre", async () => {
      analyser.mockResolvedValue({
        ok: true,
        data: { statut: "elements", elements: [element({ titre: "Acheter du lait" })] },
      });
      creer.mockResolvedValue({ ok: true, data: [{ index: 0, ok: true }] });
      const user = afficher();

      await saisir(user, "acheter du lait");
      const selecteur = await screen.findByRole("combobox", { name: "Type de « Acheter du lait »" });
      expect(selecteur).toHaveValue("tache");
      expect(screen.getByText("Priorité haute")).toBeInTheDocument();

      await user.selectOptions(selecteur, "course");

      expect(screen.getByRole("combobox", { name: "Type de « Acheter du lait »" })).toHaveValue("course");
      expect(screen.queryByText("Priorité haute")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Ajouter l'article" }));
      await waitFor(() => expect(creer).toHaveBeenCalledTimes(1));
      expect(creer.mock.calls[0][0]).toEqual([
        { type: "course", donnees: { libelle: "Acheter du lait", avertissements: [] } },
      ]);
    });

    it("garde le choix de retenir ou non une ligne quand son type change", async () => {
      analyser.mockResolvedValue({
        ok: true,
        data: { statut: "elements", elements: [element({ titre: "Idée" }), element({ titre: "Pain" })] },
      });
      const user = afficher();

      await saisir(user, "idée, pain");
      await user.click(await screen.findByRole("button", { name: "Créer « Idée »" }));
      await user.selectOptions(screen.getByRole("combobox", { name: "Type de « Idée »" }), "note");

      expect(screen.getByRole("button", { name: "Créer la tâche" })).toBeInTheDocument();
    });
  });
});
