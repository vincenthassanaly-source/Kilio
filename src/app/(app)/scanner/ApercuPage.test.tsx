import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageBrouillon } from "@/lib/scanner/brouillon";
import type { Filtre } from "@/lib/scanner/filtres";
import { ApercuPage } from "./ApercuPage";

const blob = (nom: string) => new Blob([nom], { type: "image/jpeg" });

function page(n: number, filtre: Filtre = "noirblanc"): PageBrouillon {
  const redresse = blob(`redresse-${n}`);
  return {
    id: `p${n}`,
    ordre: n,
    redresse,
    // Sans filtre, la page filtrée est la page redressée elle-même.
    traite: filtre === "original" ? redresse : blob(`traite-${n}`),
    filtre,
    largeur: 100,
    hauteur: 140,
    cree_le: "2026-11-06T10:00:00.000Z",
  };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  // Le projet n'active pas les globales de vitest : sans ce nettoyage explicite, les dialogues des
  // tests précédents (rendus dans document.body par le Portal) restent présents.
  cleanup();
  vi.restoreAllMocks();
});

describe("ApercuPage : aperçu agrandi d'une page", () => {
  it("s'ouvre sur la page demandée avec son rang", () => {
    render(<ApercuPage pages={[page(1), page(2), page(3)]} indexInitial={1} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Aperçu de la page 2" })).toBeTruthy();
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("passe d'une page à l'autre et désactive les flèches aux extrémités", () => {
    render(<ApercuPage pages={[page(1), page(2)]} indexInitial={0} onClose={vi.fn()} />);
    const precedente = screen.getByRole("button", { name: "Page précédente" }) as HTMLButtonElement;
    const suivante = screen.getByRole("button", { name: "Page suivante" }) as HTMLButtonElement;
    expect(precedente.disabled).toBe(true);
    expect(suivante.disabled).toBe(false);

    fireEvent.click(suivante);
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Aperçu de la page 2" })).toBeTruthy();
    expect(suivante.disabled).toBe(true);
    expect(precedente.disabled).toBe(false);

    fireEvent.click(precedente);
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("se déplace aussi avec les flèches du clavier", () => {
    render(<ApercuPage pages={[page(1), page(2), page(3)]} indexInitial={0} onClose={vi.fn()} />);
    const dialogue = screen.getByRole("dialog");
    fireEvent.keyDown(dialogue, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeTruthy();
    fireEvent.keyDown(dialogue, { key: "ArrowRight" });
    fireEvent.keyDown(dialogue, { key: "ArrowRight" }); // au bout : reste sur la dernière
    expect(screen.getByText("3 / 3")).toBeTruthy();
    fireEvent.keyDown(dialogue, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("affiche le résultat par défaut, puis la page avant filtre sur demande", () => {
    const pages = [page(1)];
    render(<ApercuPage pages={pages} indexInitial={0} onClose={vi.fn()} />);
    const resultat = screen.getByRole("button", { name: "Résultat" });
    const original = screen.getByRole("button", { name: "Original" });
    expect(resultat.getAttribute("aria-pressed")).toBe("true");
    expect(original.getAttribute("aria-pressed")).toBe("false");
    expect(URL.createObjectURL).toHaveBeenCalledWith(pages[0].traite);

    fireEvent.click(original);
    expect(original.getAttribute("aria-pressed")).toBe("true");
    expect(resultat.getAttribute("aria-pressed")).toBe("false");
    expect(URL.createObjectURL).toHaveBeenCalledWith(pages[0].redresse);
  });

  it("n'offre pas de bascule pour une page sans filtre (une seule version)", () => {
    render(<ApercuPage pages={[page(1, "original")]} indexInitial={0} onClose={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Version de la page" })).toBeNull();
  });

  it("masque les flèches quand il n'y a qu'une page", () => {
    render(<ApercuPage pages={[page(1)]} indexInitial={0} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Page suivante" }).className).toContain("invisible");
    expect(screen.getByRole("button", { name: "Page précédente" }).className).toContain("invisible");
  });

  it("se ferme avec le bouton et avec Échap", () => {
    const onClose = vi.fn();
    render(<ApercuPage pages={[page(1)]} indexInitial={0} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Fermer l'aperçu" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ramène un index hors limites à une page existante", () => {
    render(<ApercuPage pages={[page(1), page(2)]} indexInitial={9} onClose={vi.fn()} />);
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});
