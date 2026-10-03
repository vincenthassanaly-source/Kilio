import { describe, expect, it } from "vitest";
import { ARTICULATIONS, construireSilhouette, lirePoses, zonesDuMuscle, type Pose, type PosesExercice } from "./silhouette";

/** Pose de face très simple : 15 articulations alignées sur un axe vertical. */
function pose(decalageX = 0): Pose {
  const x = (i: number) => 100 + decalageX + (i % 2 === 0 ? 10 : -10);
  return ARTICULATIONS.map((_, i) => [x(i), 20 + i * 12] as const);
}

const POSES: PosesExercice = { v: 1, a: pose(0), b: pose(20) };

describe("lirePoses", () => {
  it("accepte une valeur bien formée", () => {
    expect(lirePoses({ v: 1, a: POSES.a, b: POSES.b })).toEqual(POSES);
  });

  it.each([
    ["null", null],
    ["une chaîne", "x"],
    ["une version inconnue", { v: 2, a: POSES.a, b: POSES.b }],
    ["une pose manquante", { v: 1, a: POSES.a }],
    ["une pose trop courte", { v: 1, a: POSES.a.slice(1), b: POSES.b }],
    ["une coordonnée non numérique", { v: 1, a: [...POSES.a.slice(1), ["x", 1]], b: POSES.b }],
    ["une coordonnée infinie", { v: 1, a: [...POSES.a.slice(1), [Infinity, 1]], b: POSES.b }],
  ])("refuse %s (retombe sur la photo)", (_, valeur) => {
    expect(lirePoses(valeur)).toBeNull();
  });
});

describe("zonesDuMuscle", () => {
  it("associe chaque muscle de la bibliothèque à au moins une zone", () => {
    for (const muscle of ["chest", "shoulders", "biceps", "triceps", "forearms", "lats", "middle back", "lower back", "traps", "neck", "abdominals", "quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"]) {
      expect(zonesDuMuscle(muscle).length).toBeGreaterThan(0);
    }
  });

  it("ne colore rien pour un muscle inconnu", () => {
    expect(zonesDuMuscle("autre")).toEqual([]);
  });
});

describe("construireSilhouette", () => {
  it("passe de la pose de départ à celle d'arrivée", () => {
    const depart = construireSilhouette(POSES, 0, []);
    const arrivee = construireSilhouette(POSES, 1, []);
    expect(depart.formes).toHaveLength(arrivee.formes.length);
    expect(depart.formes.map((f) => (f.type === "trait" ? f.d : `${f.cx},${f.cy}`))).not.toEqual(
      arrivee.formes.map((f) => (f.type === "trait" ? f.d : `${f.cx},${f.cy}`)),
    );
  });

  it("garde des épaisseurs et un sol constants pendant le mouvement", () => {
    const largeurs = (t: number) => construireSilhouette(POSES, t, []).formes.map((f) => (f.type === "trait" ? f.largeur : f.r));
    expect(largeurs(0.3)).toEqual(largeurs(0.9));
    expect(construireSilhouette(POSES, 0.3, []).sol).toBe(construireSilhouette(POSES, 0.9, []).sol);
  });

  it("met en couleur uniquement les zones du muscle travaillé", () => {
    const sansMuscle = construireSilhouette(POSES, 0.5, []).formes.filter((f) => f.cible);
    const cuisses = construireSilhouette(POSES, 0.5, zonesDuMuscle("quadriceps")).formes.filter((f) => f.cible);
    expect(sansMuscle).toHaveLength(0);
    // Une cuisse de chaque côté.
    expect(cuisses).toHaveLength(2);
  });

  it("dessine le côté droit derrière le corps", () => {
    const formes = construireSilhouette(POSES, 0, []).formes;
    expect(formes.some((f) => f.arriere)).toBe(true);
    expect(formes.at(-1)).toMatchObject({ type: "disque", arriere: false });
  });

  it("garde le sol dans la vue même si les pieds sont au bord", () => {
    const bas: Pose = ARTICULATIONS.map(() => [100, 258] as const);
    const { sol } = construireSilhouette({ v: 1, a: bas, b: bas }, 0, []);
    expect(sol).toBeLessThanOrEqual(256);
  });
});
