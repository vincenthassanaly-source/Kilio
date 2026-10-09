import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PastilleInbox } from "./PastilleInbox";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function monter(count: number) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count }) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <a href="/plus">
        Plus
        <PastilleInbox />
      </a>
    </QueryClientProvider>
  );
}

describe("PastilleInbox", () => {
  it("n'affiche rien quand l'inbox est vide", async () => {
    const { container } = monter(0);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelector("[aria-hidden]")).toBeNull();
    expect(screen.getByRole("link").textContent).toBe("Plus");
  });

  it("masque le chiffre nu et l'annonce dans le nom du lien, sans zone live", async () => {
    const { container } = monter(3);
    await waitFor(() => expect(screen.getByRole("link", { name: "Plus, 3 éléments à trier" })).toBeTruthy());
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("3");
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("plafonne l'affichage à 9+ mais annonce le vrai nombre", async () => {
    const { container } = monter(14);
    await waitFor(() => expect(screen.getByRole("link", { name: "Plus, 14 éléments à trier" })).toBeTruthy());
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("9+");
  });
});
