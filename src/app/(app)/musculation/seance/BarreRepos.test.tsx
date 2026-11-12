import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarreRepos } from "./BarreRepos";

describe("BarreRepos", () => {
  afterEach(() => cleanup());

  it("s'efface quand le clavier est ouvert (data-masquer-saisie)", () => {
    const { container } = render(
      <BarreRepos
        repos={{ debutA: "2026-01-01T00:00:00Z", finA: "2026-01-01T00:01:30Z", dureeS: 90, exerciceCle: "k1" }}
        restant={60}
        onAjuster={() => {}}
        onFermer={() => {}}
      />,
    );
    expect(container.querySelector("[data-masquer-saisie]")).not.toBeNull();
  });
});
