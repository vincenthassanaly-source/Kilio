import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detecterFeuilleAuto } from "@/lib/scanner/traitement";
import type { Quad } from "@/lib/scanner/geometrie";
import { EditeurCoins } from "./EditeurCoins";

vi.mock("@/lib/scanner/traitement", () => ({
  imageVersJpeg: vi.fn(async () => new Blob(["x"], { type: "image/jpeg" })),
  detecterFeuilleAuto: vi.fn(async () => null),
}));

const image = (width: number, height: number) =>
  ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as unknown as ImageData;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
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

  it("le bouton dit « Ajouter la page », ou « Remplacer la page » en reprise", async () => {
    const { rerender } = render(
      <EditeurCoins {...base} cle={1} source={image(100, 80)} restantes={0} onFermer={vi.fn()} />
    );
    await screen.findByText(/Feuille non détectée/);
    expect(screen.getByRole("button", { name: "Ajouter la page" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Valider" })).toBeNull();

    rerender(<EditeurCoins {...base} remplace cle={1} source={image(100, 80)} restantes={0} onFermer={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remplacer la page" })).toBeTruthy();
  });
});

describe("EditeurCoins : cadre OpenCV arrivé en retard", () => {
  const base = { enCours: false, erreur: null, onValider: vi.fn(), onAnnuler: vi.fn(), restantes: 0, onFermer: vi.fn() };
  const maison: Quad = [{ x: 10, y: 10 }, { x: 90, y: 12 }, { x: 88, y: 70 }, { x: 12, y: 68 }];
  const opencv: Quad = [{ x: 20, y: 15 }, { x: 80, y: 15 }, { x: 80, y: 65 }, { x: 20, y: 65 }];
  const points = () => document.querySelector("polygon")!.getAttribute("points");
  const enPoints = (q: Quad) => q.map((p) => `${p.x},${p.y}`).join(" ");

  function preparer() {
    let ameliorer: (q: Quad) => void = () => {};
    vi.mocked(detecterFeuilleAuto).mockImplementationOnce(async (_source, options) => {
      ameliorer = options!.surAmelioration!;
      return maison;
    });
    render(<EditeurCoins {...base} cle={1} source={image(100, 80)} />);
    return { ameliorer: (q: Quad) => act(() => ameliorer(q)) };
  }

  it("propose d'abord le cadre maison, puis le remplace par celui d'OpenCV", async () => {
    const { ameliorer } = preparer();
    await screen.findByText(/Feuille détectée/);
    expect(points()).toBe(enPoints(maison));
    ameliorer(opencv);
    expect(points()).toBe(enPoints(opencv));
  });

  it("n'écrase jamais un coin que l'utilisateur a déjà déplacé", async () => {
    const { ameliorer } = preparer();
    await screen.findByText(/Feuille détectée/);
    fireEvent.pointerDown(document.querySelectorAll("circle")[0], { pointerId: 1 });
    ameliorer(opencv);
    expect(points()).toBe(enPoints(maison));
  });

  it("n'écrase pas non plus « Photo entière »", async () => {
    const { ameliorer } = preparer();
    await screen.findByText(/Feuille détectée/);
    fireEvent.click(screen.getByRole("button", { name: "Photo entière" }));
    const entiere = points();
    ameliorer(opencv);
    expect(points()).toBe(entiere);
  });

  it("n'applique pas un cadre OpenCV arrivé après « Ajouter la page »", async () => {
    const { ameliorer } = preparer();
    await screen.findByText(/Feuille détectée/);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la page" }));
    ameliorer(opencv);
    expect(points()).toBe(enPoints(maison));
  });

  it("dit à la détection quand le recadrage est fermé, pour qu'elle abandonne le calcul tardif", async () => {
    let estAnnule: (() => boolean) | undefined;
    vi.mocked(detecterFeuilleAuto).mockImplementationOnce(async (_source, options) => {
      estAnnule = options!.estAnnule;
      return maison;
    });
    const { unmount } = render(<EditeurCoins {...base} cle={1} source={image(100, 80)} />);
    await screen.findByText(/Feuille détectée/);
    expect(estAnnule!()).toBe(false);
    unmount();
    expect(estAnnule!()).toBe(true);
  });
});
