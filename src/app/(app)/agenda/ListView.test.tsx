import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { addDays, startOfToday } from "date-fns";
import { toISODate } from "@/lib/date/iso";
import type { Evenement } from "@/app/actions/evenements";
import { ListView } from "./ListView";

vi.mock("../taches/TasksList", () => ({ TaskCard: () => null }));

afterEach(cleanup);

function evenement(date: string): Evenement {
  return {
    id: `e-${date}`,
    titre: "Dentiste",
    date,
    heure: "09:00",
    heure_fin: "10:00",
    toute_la_journee: false,
  } as unknown as Evenement;
}

const aujourdhui = toISODate(startOfToday());
const demain = toISODate(addDays(startOfToday(), 1));

function rendre(evenements: Evenement[]) {
  render(<ListView taches={[]} evenements={evenements} listes={[]} tags={[]} />);
}

describe("ListView : point de départ « Aujourd'hui »", () => {
  it("annonce « Rien de prévu pour l'instant » quand la liste est vide", () => {
    rendre([]);
    expect(screen.getByText(/Rien de prévu pour l'instant/)).toBeTruthy();
  });

  it("commence par « Aujourd'hui » même quand rien n'y est prévu", () => {
    rendre([evenement(demain)]);
    const titres = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
    expect(titres[0]).toMatch(/^Aujourd'hui · /);
    expect(screen.getByText("Rien de prévu.")).toBeTruthy();
    expect(titres).toHaveLength(2);
  });

  it("ne répète pas l'ancrage quand aujourd'hui a déjà quelque chose", () => {
    rendre([evenement(aujourdhui), evenement(demain)]);
    const titres = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
    expect(titres.filter((t) => t.startsWith("Aujourd'hui"))).toHaveLength(1);
    expect(screen.queryByText("Rien de prévu.")).toBeNull();
  });
});
