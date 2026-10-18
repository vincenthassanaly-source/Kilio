import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelecteurCouleur, TexteProposition } from "./CouleursOpinions";

const termes = [
  { terme: "TVA", definition: "un impôt sur ce qu'on achète" },
  { terme: "PIB", definition: null },
];

describe("TexteProposition", () => {
  it("surligne les mots-clés et ouvre la définition au tap, puis la ferme", () => {
    render(<TexteProposition texte="Baisser la TVA et suivre le PIB." termes={termes} theme="fiscalite" />);

    // Sans définition : simple surlignage, pas de bouton.
    expect(screen.getByText("PIB").tagName).toBe("MARK");
    expect(screen.queryByRole("note")).toBeNull();

    const bouton = screen.getByRole("button", { name: "TVA, définition" });
    expect(bouton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toHaveTextContent("TVA : un impôt sur ce qu'on achète");

    fireEvent.keyDown(bouton, { key: "Escape" });
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("affiche le texte tel quel sans mots-clés", () => {
    render(<TexteProposition texte="Texte simple." termes={[]} theme="sante" />);
    expect(screen.getByText("Texte simple.")).toBeInTheDocument();
  });
});

describe("SelecteurCouleur", () => {
  it("expose les teintes en boutons radio nommés et signale celles déjà prises", () => {
    const choix: string[] = [];
    render(<SelecteurCouleur valeur="indigo" onChange={(c) => choix.push(c)} utilisees={["corail"]} />);

    expect(screen.getByRole("radio", { name: "Indigo" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Corail/ }));
    expect(choix).toEqual(["corail"]);
    expect(screen.getByText(/Corail \(déjà utilisée/)).toBeInTheDocument();
  });
});
