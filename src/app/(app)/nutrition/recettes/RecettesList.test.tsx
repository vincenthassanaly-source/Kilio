import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecettesList, type RecetteView } from "./RecettesList";

vi.mock("@/components/TransitionLink", () => ({
  TransitionLink: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const recette = { id: "r1", nom: "Soupe", source: "manuel", temps_prepa_min: 10, portions: 2, kcalParPortion: 250, ingredientsText: "" } as unknown as RecetteView;

describe("RecettesList", () => {
  afterEach(cleanup);

  it("expose l'état des filtres avec aria-pressed, dans des groupes nommés", async () => {
    render(<RecettesList recettes={[recette]} />);
    expect(screen.getByRole("group", { name: "Temps de préparation" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Calories par portion" })).toBeInTheDocument();

    const chip = screen.getByRole("button", { name: "< 15 min" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });
});
