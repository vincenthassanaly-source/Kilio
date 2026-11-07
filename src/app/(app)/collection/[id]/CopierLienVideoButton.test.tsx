import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CopierLienVideoButton } from "./CopierLienVideoButton";

const URL_VIDEO = "https://www.youtube.com/watch?v=abc123";

function mockPressePapier(writeText: (texte: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function cliquer() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien de la vidéo" }));
  });
}

describe("CopierLienVideoButton", () => {
  it("copie l'URL d'origine et annonce « Lien copié »", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockPressePapier(writeText);
    render(<CopierLienVideoButton url={URL_VIDEO} />);

    await cliquer();

    expect(writeText).toHaveBeenCalledWith(URL_VIDEO);
    expect(screen.getByRole("status").textContent).toBe("Lien copié");
  });

  it("revient à l'état initial après 2 s", async () => {
    mockPressePapier(vi.fn().mockResolvedValue(undefined));
    render(<CopierLienVideoButton url={URL_VIDEO} />);

    await cliquer();
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("annonce « Échec de la copie » quand le presse-papier refuse", async () => {
    mockPressePapier(vi.fn().mockRejectedValue(new Error("denied")));
    render(<CopierLienVideoButton url={URL_VIDEO} />);

    await cliquer();

    expect(screen.getByRole("status").textContent).toBe("Échec de la copie");
  });
});
