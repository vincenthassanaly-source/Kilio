import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExerciceBrouillon } from "@/lib/musculation/seance";
import { ExerciceBloc } from "./ExerciceBloc";

vi.mock("../AnimationExercice", () => ({ AnimationMiniature: () => null }));
vi.mock("@/lib/haptics", () => ({ vibrate: vi.fn() }));
vi.mock("@/lib/musculation/useMinuteurRepos", () => ({ deverrouillerAudio: vi.fn() }));

const exercice: ExerciceBrouillon = {
  cle: "k1",
  exerciceId: "e1",
  nom: "Développé couché",
  mode: "poids_reps",
  reposS: 90,
  series: [{ id: "s1", type: "normale", poids: 60, reps: 8, duree: null, distance: null, fait: false, faitA: null, reposPris: null }],
  precedent: [],
};

function rendre(props: { edition?: boolean; onBasculer?: () => void } = {}) {
  return render(
    <ExerciceBloc
      exercice={exercice}
      onModifierSerie={() => {}}
      onBasculer={props.onBasculer ?? (() => {})}
      onAjouterSerie={() => {}}
      onRetirerDerniereSerie={() => {}}
      onRetirerExercice={() => {}}
      onReposExercice={() => {}}
      edition={props.edition}
    />,
  );
}

describe("ExerciceBloc", () => {
  afterEach(() => cleanup());

  it("ignore un double tap rapide sur le ✓ d'une même série", () => {
    const onBasculer = vi.fn();
    rendre({ onBasculer });
    const coche = screen.getByRole("button", { name: "Valider la série 1" });
    fireEvent.click(coche);
    fireEvent.click(coche);
    expect(onBasculer).toHaveBeenCalledTimes(1);
  });

  it("le panneau d'options est un groupe (disclosure), pas un menu ARIA", () => {
    rendre();
    fireEvent.click(screen.getByRole("button", { name: "Options de Développé couché" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("group", { name: "Options de Développé couché" })).not.toBeNull();
  });

  it("masque la colonne « Précédent » en modification d'une séance passée", () => {
    const { container } = rendre();
    expect(container.textContent).toContain("Précédent");
    cleanup();
    const { container: edition } = rendre({ edition: true });
    expect(edition.textContent).not.toContain("Précédent");
  });
});
