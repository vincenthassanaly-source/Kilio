import { describe, expect, it } from "vitest";
import { filtrerExercices, normaliser } from "./catalogue";
import type { ExerciceCatalogue } from "./serveur";

const exo = (nom: string, muscle: ExerciceCatalogue["muscle"], materiel: string | null = null): ExerciceCatalogue => ({
  id: nom,
  nom,
  mode: "poids_reps",
  muscle,
  materiel,
  reposDefautS: null,
  animation: null,
});

const catalogue = [
  exo("Développé couché", "pectoraux", "Barre"),
  exo("Squat", "quadriceps", "Barre"),
  exo("Curl biceps", "biceps", "Haltères"),
];

describe("filtrerExercices", () => {
  it("ignore accents et casse", () => {
    expect(normaliser("  Développé ")).toBe("developpe");
    expect(filtrerExercices(catalogue, { recherche: "DEVELOPPE", muscle: null }).map((e) => e.nom)).toEqual([
      "Développé couché",
    ]);
  });

  it("exige tous les mots, nom ou matériel", () => {
    expect(filtrerExercices(catalogue, { recherche: "barre squat", muscle: null }).map((e) => e.nom)).toEqual(["Squat"]);
    expect(filtrerExercices(catalogue, { recherche: "haltères curl", muscle: null })).toHaveLength(1);
    expect(filtrerExercices(catalogue, { recherche: "inconnu", muscle: null })).toEqual([]);
  });

  it("filtre par muscle principal, seul ou avec une recherche", () => {
    expect(filtrerExercices(catalogue, { recherche: "", muscle: "biceps" }).map((e) => e.nom)).toEqual(["Curl biceps"]);
    expect(filtrerExercices(catalogue, { recherche: "squat", muscle: "biceps" })).toEqual([]);
    expect(filtrerExercices(catalogue, { recherche: "", muscle: null })).toHaveLength(3);
  });
});
