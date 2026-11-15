import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
vi.mock("./MenuFeuille", () => ({ MenuFeuille: () => null }));
vi.mock("./SaisieClavier", () => ({ SaisieClavier: () => null }));
vi.mock("@/components/BackLink", () => ({
  BackLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/TransitionLink", () => ({
  TransitionLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { getFeuille } from "@/app/actions/vidage";
import { FeuilleView } from "./FeuilleView";

const JOUR = "2026-11-12";

function monter(retour: { href: string; libelle: string }) {
  vi.mocked(getFeuille).mockResolvedValue({
    ok: true,
    data: { jour: JOUR, traits: [], hauteur: 600, apercuUrl: null, updatedAt: null, transcription: null },
  } as never);
  render(<FeuilleView jour={JOUR} aujourdhui={JOUR} retour={retour} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FeuilleView : bouton « Calendrier » de l'en-tête", () => {
  it("est proposé quand on arrive d'ailleurs que du Calendrier", async () => {
    monter({ href: "/plus", libelle: "Plus" });
    expect(await screen.findByRole("link", { name: "Calendrier" })).toHaveAttribute("href", "/journal/calendrier");
  });

  it("n'est pas répété quand le lien de retour mène déjà au Calendrier", async () => {
    monter({ href: "/journal/calendrier", libelle: "Calendrier" });
    await screen.findByRole("link", { name: "Calendrier" });
    // Un seul lien « Calendrier » : le retour, pas un second bouton dans l'en-tête.
    expect(screen.getAllByRole("link", { name: "Calendrier" })).toHaveLength(1);
  });
});
