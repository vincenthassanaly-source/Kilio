import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@/components/toast/toast-store";

vi.mock("@/app/actions/vidage", () => ({
  ajouterTexte: vi.fn(),
  enregistrerApercu: vi.fn(),
  enregistrerTranscription: vi.fn(),
  getFeuille: vi.fn(),
  supprimerTranscription: vi.fn(),
  transcrireFeuille: vi.fn(),
  validerTranscription: vi.fn(),
}));
vi.mock("@/lib/vidage/local", () => ({
  EVENEMENT_FEUILLE_EN_ATTENTE: "feuille-en-attente",
  EVENEMENT_FEUILLE_FUSIONNEE: "feuille-fusionnee",
  choisirFeuille: () => ({ source: "serveur", traits: [] }),
  compterFeuillesEnAttente: async () => 0,
  ecrireFeuilleLocale: vi.fn(),
  fusionnerTraits: (a: unknown[]) => a,
  lireFeuilleLocale: async () => null,
  memoriserFeuilleServeur: vi.fn(),
  synchroniserFeuilles: vi.fn(),
}));
vi.mock("@/lib/vidage/apercu", () => ({ genererApercu: vi.fn(), genererTranches: vi.fn() }));
vi.mock("./FeuilleCanvas", () => ({ FeuilleCanvas: () => null }));
vi.mock("./BarreOutils", () => ({ BarreOutils: () => null }));
vi.mock("@/components/BackLink", () => ({ BackLink: () => null }));
vi.mock("@/components/TransitionLink", () => ({ TransitionLink: () => null }));
vi.mock("./MenuFeuille", () => ({
  MenuFeuille: ({ onVoirTexte }: { onVoirTexte: () => void }) => (
    <button type="button" onClick={onVoirTexte}>
      Voir le texte
    </button>
  ),
}));
vi.mock("./SaisieClavier", () => ({
  SaisieClavier: ({ onAjouter }: { onAjouter: (t: string) => Promise<boolean> }) => (
    <button type="button" onClick={() => void onAjouter("Nouvelle note")}>
      Ajouter la note
    </button>
  ),
}));

import { ajouterTexte, getFeuille, supprimerTranscription } from "@/app/actions/vidage";
import { FeuilleView } from "./FeuilleView";

const JOUR = "2026-11-12";

/** Ouvre le texte du jour ; `fauxTemps` : minuteurs simulés juste avant le geste de suppression. */
async function monter(fauxTemps = false) {
  vi.mocked(getFeuille).mockResolvedValue({
    ok: true,
    data: { jour: JOUR, traits: [], hauteur: 600, apercuUrl: null, updatedAt: null, transcription: "Ma journée" },
  } as never);
  vi.mocked(supprimerTranscription).mockResolvedValue({ ok: true, data: undefined });
  render(<FeuilleView jour={JOUR} aujourdhui={JOUR} retour={{ href: "/plus", libelle: "Plus" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Voir le texte" }));
  const supprimer = await screen.findByRole("button", { name: "Supprimer le texte" });
  if (fauxTemps) vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fireEvent.click(supprimer);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const t of [...getToasts()]) dismissToast(t.id);
  vi.clearAllMocks();
});

const toastAnnuler = () => getToasts().find((t) => t.action);
async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("FeuilleView : suppression du texte du jour avec annulation différée", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("supprime le texte tout de suite à l'écran, sans boîte de confirmation ni appel serveur", async () => {
    await monter();
    expect(screen.queryByText("Supprimer le texte ?")).not.toBeInTheDocument();
    expect(supprimerTranscription).not.toHaveBeenCalled();
    expect(toastAnnuler()?.text).toBe("Texte du jour supprimé");
    expect(toastAnnuler()?.action?.label).toBe("Annuler");
    // La fenêtre du texte se ferme (après son animation de sortie).
    await waitFor(() => expect(screen.queryByDisplayValue("Ma journée")).not.toBeInTheDocument());
  });

  it("« Annuler » ramène le texte sans appel serveur", async () => {
    await monter(true);
    act(() => toastAnnuler()?.action?.onAction());
    fireEvent.click(screen.getByRole("button", { name: "Voir le texte" }));
    expect(screen.getByDisplayValue("Ma journée")).toBeInTheDocument();
    await avancer(10_000);
    expect(supprimerTranscription).not.toHaveBeenCalled();
  });

  it("supprime le texte côté serveur après le délai", async () => {
    await monter(true);
    await avancer(6100);
    expect(supprimerTranscription).toHaveBeenCalledWith(JOUR);
  });

  it("annule la suppression si une note est ajoutée pendant le délai (elle serait emportée avec l'ancien texte)", async () => {
    vi.mocked(ajouterTexte).mockResolvedValue({ ok: true, data: { texte: "Ma journée\n\nNouvelle note" } });
    await monter(true);
    fireEvent.click(screen.getByRole("button", { name: "Clavier" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la note" }));
    await avancer(10_000);
    expect(ajouterTexte).toHaveBeenCalledWith(JOUR, "Nouvelle note");
    expect(supprimerTranscription).not.toHaveBeenCalled();
  });
});
