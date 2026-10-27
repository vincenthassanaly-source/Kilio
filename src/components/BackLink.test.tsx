import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { BackLink } from "./BackLink";
import { OngletsPharmacie } from "@/app/(app)/pharmacie/OngletsPharmacie";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pharmacie",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("BackLink", () => {
  it("pointe vers la destination et s'annonce « Retour vers … »", () => {
    render(<BackLink href="/collection">Collection</BackLink>);

    const lien = screen.getByRole("link", { name: "Retour vers Collection" });
    expect(lien).toHaveProperty("pathname", "/collection");
  });

  it("cache le chevron aux lecteurs d'écran", () => {
    render(<BackLink href="/objectifs">Objectifs</BackLink>);

    expect(screen.getByRole("link").querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("garde le libellé tel quel avec sansPrefixe", () => {
    render(
      <BackLink href="/pharmacie/referentiel" sansPrefixe>
        Retour
      </BackLink>,
    );

    expect(screen.getByRole("link", { name: "Retour" })).toBeTruthy();
  });
});

describe("OngletsPharmacie", () => {
  it("marque l'onglet actif avec aria-current et garde le nom complet des huiles", () => {
    render(<OngletsPharmacie actif="huiles" />);

    expect(screen.getByRole("link", { name: "Huiles essentielles" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Cours" }).getAttribute("aria-current")).toBeNull();
  });
});
