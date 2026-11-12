import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/app/actions/habitudes", () => ({
  enregistrerEntreeHabitude: vi.fn(),
  supprimerHabitude: vi.fn(),
  getHistoriqueHabitude: vi.fn().mockResolvedValue([{ date: "2026-11-03", valeur: 3 }]),
  creerHabitude: vi.fn(),
  modifierHabitude: vi.fn(),
}));
vi.mock("@/lib/actions/suppressionDifferee", () => ({ supprimerAvecAnnulation: vi.fn() }));
vi.mock("@/lib/haptics", () => ({ vibrate: vi.fn() }));

import { HabitudeCard } from "./HabitudeCard";
import { HistoriqueView } from "./HistoriqueView";

afterEach(cleanup);

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const base = {
  id: "h1",
  nom: "Boire de l'eau",
  icone: "",
  type: "boolean",
  streak: 0,
  frequence_hebdo: null,
  faitsCetteSemaine: 0,
  valeur_cible: null,
  unite: null,
  objectifs: [],
  entreeDuJour: null,
};

describe("HabitudeCard", () => {
  it("nomme la coche par l'habitude et annonce son état", () => {
    wrap(<ul><HabitudeCard habitude={base as never} date="2026-11-12" /></ul>);
    const bouton = screen.getByRole("button", { name: "Boire de l'eau" });
    expect(bouton).toHaveAttribute("aria-pressed", "false");
  });

  it("valide la saisie quantifiée avec Entrée (blur)", () => {
    const h = { ...base, type: "quantifiee", unite: "verres", valeur_cible: 8 };
    wrap(<ul><HabitudeCard habitude={h as never} date="2026-11-12" /></ul>);
    const champ = screen.getByLabelText("Valeur de Boire de l'eau");
    expect(champ).toHaveAttribute("enterkeyhint", "done");
    champ.focus();
    expect(document.activeElement).toBe(champ);
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(document.activeElement).not.toBe(champ);
  });
});

describe("HistoriqueView", () => {
  const h = { ...base, type: "quantifiee", valeur_cible: 8, unite: "verres" };

  it("retombe sur la première habitude et décrit chaque jour", async () => {
    wrap(<HistoriqueView habitudes={[h as never]} />);
    expect(await screen.findAllByText(/non fait/)).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Mois précédent" })).toBeInTheDocument();
  });

  it("affiche une erreur plutôt que « aucune habitude » quand le chargement a échoué", () => {
    wrap(<HistoriqueView habitudes={[]} isError />);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger les habitudes.");
  });
});
