import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CourseItemRow } from "./CourseItemRow";

vi.mock("@/app/actions/courses", () => new Proxy({}, { get: () => vi.fn() }));

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  libelle: "Lait",
  coche: false,
  created_at: "2026-11-12T10:00:00Z",
  termine_le: null,
} as never;

function renderRow(item: object) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ul>
        <CourseItemRow item={item as never} />
      </ul>
    </QueryClientProvider>
  );
}

describe("CourseItemRow accessibilité", () => {
  it("la coche garde le libellé comme nom et annonce l'état via aria-pressed", () => {
    const { rerender } = renderRow(base);
    expect(screen.getByRole("button", { name: "Lait" }).getAttribute("aria-pressed")).toBe("false");
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ul>
          <CourseItemRow item={{ ...(base as object), coche: true } as never} />
        </ul>
      </QueryClientProvider>
    );
    expect(screen.getByRole("button", { name: "Lait" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("le bouton de suppression nomme l'article et affiche « Supprimer »", () => {
    renderRow(base);
    const btn = screen.getByRole("button", { name: "Supprimer « Lait »" });
    expect(btn.textContent).toBe("Supprimer");
  });
});
