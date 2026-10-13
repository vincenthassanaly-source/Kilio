import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComparaisonObjectif } from "./ComparaisonObjectif";

afterEach(cleanup);

const cible = { kcal: 2000, proteines: 150, glucides: 200, lipides: 70 };
const prevu = (kcal: number) => ({ kcal, proteines: 160, glucides: 180, lipides: 60 });

describe("ComparaisonObjectif", () => {
  it("indique qu'il ne reste rien de planifié quand le jour est vide", () => {
    render(<ComparaisonObjectif prevu={prevu(0)} cible={cible} libre={false} />);
    expect(screen.getByText("Rien de planifié ce jour-là.")).toBeInTheDocument();
  });

  it("affiche ce qu'il reste sous la cible", () => {
    render(<ComparaisonObjectif prevu={prevu(1800)} cible={cible} libre={false} />);
    expect(screen.getByText("il reste 200 kcal")).toBeInTheDocument();
    expect(screen.getByText(/P 160 \/ 150 g/)).toBeInTheDocument();
  });

  it("nomme un léger dépassement sans alerte", () => {
    render(<ComparaisonObjectif prevu={prevu(2100)} cible={cible} libre={false} />);
    const message = screen.getByText("100 kcal au-dessus");
    expect(message).toHaveClass("text-warning");
  });

  it("passe en alerte au-delà de 10 %", () => {
    render(<ComparaisonObjectif prevu={prevu(2400)} cible={cible} libre={false} />);
    const message = screen.getByText("dépassé de 400 kcal");
    expect(message).toHaveClass("text-alert");
  });

  it("n'alerte jamais sur les protéines au-dessus de la cible", () => {
    render(<ComparaisonObjectif prevu={prevu(1800)} cible={cible} libre={false} />);
    expect(screen.getByText(/P 160 \/ 150 g/)).not.toHaveClass("text-alert");
  });

  it("suspend la comparaison un jour libre", () => {
    render(<ComparaisonObjectif prevu={prevu(3000)} cible={cible} libre />);
    expect(screen.getByText("Jour libre")).toBeInTheDocument();
    expect(screen.queryByText(/dépassé/)).not.toBeInTheDocument();
  });

  it("signale l'absence d'objectif sans inventer de cible", () => {
    render(<ComparaisonObjectif prevu={prevu(1800)} cible={null} libre={false} />);
    expect(screen.getByText(/pas d'objectif défini/)).toBeInTheDocument();
  });
});
