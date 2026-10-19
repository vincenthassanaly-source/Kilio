import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuiviProposition } from "./SuiviProposition";

afterEach(cleanup);

describe("SuiviProposition", () => {
  it("reflète l'état lu et favori", () => {
    render(<SuiviProposition proposition={{ lu: true, favori: false }} onBasculer={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Lu" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Mettre en favori" })).toHaveAttribute("aria-pressed", "false");
  });

  it("annonce « Retirer des favoris » quand la proposition est en favori", () => {
    render(<SuiviProposition proposition={{ lu: false, favori: true }} onBasculer={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Lu" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Retirer des favoris" })).toHaveAttribute("aria-pressed", "true");
  });

  it("bascule lu et favori indépendamment", () => {
    const onBasculer = vi.fn();
    render(<SuiviProposition proposition={{ lu: false, favori: false }} onBasculer={onBasculer} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Lu" }));
    expect(onBasculer).toHaveBeenLastCalledWith("lu");
    fireEvent.click(screen.getByRole("button", { name: "Mettre en favori" }));
    expect(onBasculer).toHaveBeenLastCalledWith("favori");
    expect(onBasculer).toHaveBeenCalledTimes(2);
  });
});
