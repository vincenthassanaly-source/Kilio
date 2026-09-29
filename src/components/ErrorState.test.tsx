import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorState } from "./ErrorState";
import AppError from "@/app/(app)/error";
import RootError from "@/app/error";
import NotFound from "@/app/not-found";

// Vitest tourne sans globals : RTL ne nettoie pas seul entre deux tests.
afterEach(() => {
  cleanup();
});

describe("ErrorState", () => {
  it("relance le rendu avec retry au clic sur « Réessayer »", async () => {
    const retry = vi.fn();
    render(<ErrorState retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("propose un lien de retour à l'accueil", () => {
    render(<ErrorState retry={() => {}} />);

    expect(screen.getByRole("link", { name: "Retour à l'accueil" })).toHaveProperty(
      "pathname",
      "/"
    );
  });
});

describe.each([
  ["app/(app)/error.tsx", AppError],
  ["app/error.tsx", RootError],
])("%s", (_nom, ErrorBoundary) => {
  it("transmet retry de Next.js au bouton « Réessayer »", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<ErrorBoundary error={new Error("boom")} retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("not-found.tsx", () => {
  it("annonce la page introuvable et ramène à l'accueil", () => {
    render(<NotFound />);

    expect(screen.getByText("Page introuvable")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à l'accueil" })).toHaveProperty(
      "pathname",
      "/"
    );
  });
});
