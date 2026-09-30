import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContenuColore } from "./ContenuColore";

describe("ContenuColore", () => {
  it("rend un contenu sans balise comme un simple paragraphe, texte intact", () => {
    const contenu = "Normale : 0,70 à 1,10 g/L.\nConversion : g/L × 5,55.";
    const { container } = render(<ContenuColore contenu={contenu} />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p")?.textContent).toBe(contenu);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("rend une ligne balisée avec libellé accessible, sans afficher la balise", () => {
    render(<ContenuColore contenu={"[rouge] Diabète : ≥ 1,26 g/L"} />);
    expect(screen.getByText(/Diabète : ≥ 1,26 g\/L/)).toBeInTheDocument();
    expect(screen.getByText(/Danger/)).toHaveClass("sr-only");
    expect(screen.queryByText(/\[rouge\]/)).toBeNull();
  });

  it("garde le texte hors balise et colore les seules lignes balisées", () => {
    const { container } = render(<ContenuColore contenu={"Intro\n[vert] Normale\n[orange] Prédiabète"} />);
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });
});
