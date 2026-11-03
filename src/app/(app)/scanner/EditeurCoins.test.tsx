import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditeurCoins } from "./EditeurCoins";

vi.mock("@/lib/scanner/traitement", () => ({
  imageVersJpeg: vi.fn(async () => new Blob(["x"], { type: "image/jpeg" })),
  detecterFeuille: vi.fn(() => null),
}));

const image = (width: number, height: number) =>
  ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as unknown as ImageData;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EditeurCoins : file d'import", () => {
  const base = {
    enCours: false,
    erreur: null,
    onValider: vi.fn(),
    onAnnuler: vi.fn(),
  };

  it("garde le même dialogue d'une photo à la suivante, sans l'abandonner", async () => {
    // Régression : démonter le dialogue entre deux photos faisait un
    // history.back() (useBackClose) qui fermait aussitôt la photo suivante.
    const onFermer = vi.fn();
    const { rerender } = render(<EditeurCoins {...base} cle={1} source={image(100, 80)} restantes={1} onFermer={onFermer} />);
    const dialogue = screen.getByRole("dialog", { name: "Recadrer le document" });
    await screen.findByText(/Feuille non détectée/);
    expect(screen.getByText(/1 autre photo ensuite/)).toBeTruthy();

    rerender(<EditeurCoins {...base} cle={2} source={image(60, 90)} restantes={0} onFermer={onFermer} />);

    expect(screen.getByRole("dialog", { name: "Recadrer le document" })).toBe(dialogue);
    await screen.findByText(/Feuille non détectée/);
    expect(screen.queryByText(/autre photo ensuite/)).toBeNull();
    // Laisse partir un éventuel popstate différé.
    await new Promise((r) => setTimeout(r, 50));
    expect(onFermer).not.toHaveBeenCalled();
  });
});
