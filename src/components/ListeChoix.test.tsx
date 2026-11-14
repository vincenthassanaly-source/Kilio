import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LigneChoix } from "./ListeChoix";

afterEach(() => cleanup());

describe("LigneChoix", () => {
  it("expose l'état via aria-pressed et affiche la coche seulement si choisie", () => {
    const { rerender, container } = render(
      <LigneChoix selected={false} onSelect={() => {}}>
        Cuisine
      </LigneChoix>
    );
    expect(screen.getByRole("button", { name: "Cuisine" }).getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector("svg")).toBeNull();

    rerender(
      <LigneChoix selected onSelect={() => {}}>
        Cuisine
      </LigneChoix>
    );
    expect(screen.getByRole("button", { name: "Cuisine" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("appelle onSelect au clic", async () => {
    const onSelect = vi.fn();
    render(
      <LigneChoix selected={false} onSelect={onSelect}>
        Jardin
      </LigneChoix>
    );
    await userEvent.click(screen.getByRole("button", { name: "Jardin" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
