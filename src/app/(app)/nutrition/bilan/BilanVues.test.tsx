import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { LegendeStatuts } from "./BilanVues";

afterEach(cleanup);

describe("LegendeStatuts", () => {
  it("nomme chaque statut que le calendrier peut afficher", () => {
    render(<LegendeStatuts />);
    const items = within(screen.getByRole("list", { name: "Légende" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(items).toEqual([
      "Cibles atteintes",
      "Dépassement léger",
      "Dépassement net",
      "Journée en cours",
      "Jour libre",
      "Sans saisie",
    ]);
  });
});
