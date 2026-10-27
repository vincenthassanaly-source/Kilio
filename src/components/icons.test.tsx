import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { CheckIcon, CrossIcon, FlameIcon, StarIcon } from "./icons";

afterEach(() => cleanup());

describe("icônes partagées", () => {
  it.each([
    ["CheckIcon", <CheckIcon key="c" />],
    ["CrossIcon", <CrossIcon key="x" />],
    ["FlameIcon", <FlameIcon key="f" />],
    ["StarIcon", <StarIcon key="s" />],
  ])("%s est décorative (aria-hidden) et suit la couleur du texte", (_nom, icone) => {
    const { container } = render(icone);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });

  it("respecte la taille demandée", () => {
    const { container } = render(<FlameIcon size={20} />);

    expect(container.querySelector("svg")?.getAttribute("width")).toBe("20");
  });

  it("StarIcon se remplit seulement quand filled est vrai", () => {
    const { container, rerender } = render(<StarIcon />);
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("none");

    rerender(<StarIcon filled />);
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
  });
});
