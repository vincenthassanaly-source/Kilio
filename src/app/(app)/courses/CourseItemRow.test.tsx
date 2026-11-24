import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { dismissToast, getToasts } from "@/components/toast/toast-store";
import { deleteCourseItem, toggleCourseItem } from "@/app/actions/courses";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CourseItemRow } from "./CourseItemRow";

vi.mock("@/app/actions/courses", () => ({
  createCourseItem: vi.fn(),
  toggleCourseItem: vi.fn(),
  deleteCourseItem: vi.fn(),
  deleteCourseItems: vi.fn(),
  updateCourseItem: vi.fn(),
  getCoursesItems: vi.fn(),
  restoreCourseItems: vi.fn(),
  ajouterArticlesCourses: vi.fn(),
}));

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

afterEach(() => {
  cleanup();
  for (const t of [...getToasts()]) dismissToast(t.id);
  vi.useRealTimers();
});

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

describe("CourseItemRow : gestes", () => {
  it("un tap sur le libellé coche l'article et propose « Annuler »", async () => {
    renderRow(base);
    fireEvent.click(screen.getByText("Lait"));
    await waitFor(() => expect(toggleCourseItem).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", true));
    const toast = getToasts().find((t) => t.action);
    expect(toast?.text).toBe("« Lait » pris");
    expect(toast?.action?.label).toBe("Annuler");
  });

  it("la suppression propose « Annuler » dès le geste, et le retire si le serveur échoue", async () => {
    let echouer: (err: Error) => void = () => {};
    vi.mocked(deleteCourseItem).mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => (echouer = reject))
    );
    renderRow(base);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer « Lait »" }));
    await waitFor(() => expect(getToasts().find((t) => t.action)?.text).toBe("« Lait » supprimé"));
    await act(async () => echouer(new Error("refus serveur")));
    await waitFor(() => expect(getToasts().some((t) => t.action)).toBe(false));
    expect(getToasts().some((t) => t.text === "Impossible de supprimer l'article.")).toBe(true);
  });

  it("un appui long sur le libellé ouvre le renommage sans cocher", () => {
    vi.useFakeTimers();
    vi.mocked(toggleCourseItem).mockClear();
    renderRow(base);
    const libelle = screen.getByText("Lait").closest("button")!;
    fireEvent.pointerDown(libelle, { isPrimary: true, pointerType: "touch", clientX: 0, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("textbox", { name: "Renommer « Lait »" })).toBeTruthy();
    expect(toggleCourseItem).not.toHaveBeenCalled();
  });
});
