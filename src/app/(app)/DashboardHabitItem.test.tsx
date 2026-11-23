import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardHabitItem } from "./DashboardHabitItem";

vi.mock("@/app/actions/habitudes", () => ({ enregistrerEntreeHabitude: vi.fn(), supprimerHabitude: vi.fn() }));

afterEach(() => cleanup());

const base = {
  id: "h1",
  nom: "Eau",
  icone: null,
  unite: "verres",
  valeur_cible: 8,
  frequence_hebdo: null,
  streak: 0,
  faitsCetteSemaine: 0,
  entreeDuJour: { id: "e", habitude_id: "h1", date: "2026-11-23", valeur: 3, created_at: "" },
};

function rendre(habitude: object) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DashboardHabitItem habitude={habitude as never} date="2026-11-23" />
    </QueryClientProvider>
  );
}

describe("DashboardHabitItem", () => {
  it("habitude chiffrée : lien vers Habitudes (pas de +1), valeur du jour affichée", () => {
    rendre({ ...base, type: "quantifiee" });
    const lien = screen.getByRole("link", { name: /Eau : 3 \/ 8 verres/ });
    expect(lien.getAttribute("href")).toBe("/habitudes");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("habitude à cocher : bouton à bascule", () => {
    rendre({ ...base, type: "boolean", entreeDuJour: null });
    expect(screen.getByRole("button", { name: /Eau/ }).getAttribute("aria-pressed")).toBe("false");
  });
});
