import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExplicationProposition } from "./ExplicationProposition";

afterEach(cleanup);

describe("ExplicationProposition", () => {
  it("indique qu'il n'y a pas encore d'explication", () => {
    render(<ExplicationProposition explication={null} />);
    expect(screen.getByText("Pas encore expliquée.")).toBeInTheDocument();
    expect(screen.queryByText("Comprendre cette proposition")).toBeNull();
  });

  it("présente le concret puis les deux arguments au même rang", () => {
    render(<ExplicationProposition explication={{ concret: "Elle change X.", pour: "Argument A.", contre: "Argument B." }} />);
    const titres = screen.getAllByRole("heading", { level: 4, hidden: true }).map((h) => h.textContent);
    expect(titres).toEqual(["Ce que ça change", "Le meilleur argument pour", "Le meilleur argument contre"]);
    expect(screen.getByText("Argument A.")).toBeInTheDocument();
    expect(screen.getByText("Argument B.")).toBeInTheDocument();
  });

  it("saute les champs vides", () => {
    render(<ExplicationProposition explication={{ concret: "Elle change X.", pour: "", contre: "" }} />);
    expect(screen.getAllByRole("heading", { level: 4, hidden: true })).toHaveLength(1);
  });
});
