import { describe, expect, it } from "vitest";
import { exerciceDepuisRoutine, modeOuDefaut, validerNomDossier, validerRoutine, type RoutineDetail, type RoutineEntree } from "./routines";

const EXO = "11111111-1111-4111-8111-111111111111";
const DOSSIER = "22222222-2222-4222-8222-222222222222";

function compteur() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

const serie = { type: "normale" as const, poids: 80, reps: 8, duree: null, distance: null };

function routine(extra: Partial<RoutineEntree> = {}): RoutineEntree {
  return {
    nom: "Push A",
    typeSeance: "PUSH",
    dossierId: null,
    exercices: [{ exerciceId: EXO, reposS: null, series: [serie] }],
    ...extra,
  };
}

describe("validerRoutine", () => {
  it("accepte une routine valide, avec ou sans type et dossier", () => {
    expect(validerRoutine(routine())).toBeNull();
    expect(validerRoutine(routine({ typeSeance: null, dossierId: DOSSIER }))).toBeNull();
    expect(validerRoutine({ ...routine(), id: DOSSIER })).toBeNull();
  });

  it.each([
    ["nom vide", routine({ nom: "  " })],
    ["nom trop long", routine({ nom: "x".repeat(81) })],
    ["type inconnu", { ...routine(), typeSeance: "ARMS" }],
    ["dossier invalide", { ...routine(), dossierId: "abc" }],
    ["aucun exercice", routine({ exercices: [] })],
    ["exercice invalide", routine({ exercices: [{ exerciceId: "abc", reposS: null, series: [serie] }] })],
    ["repos hors bornes", routine({ exercices: [{ exerciceId: EXO, reposS: 5000, series: [serie] }] })],
    ["aucune série", routine({ exercices: [{ exerciceId: EXO, reposS: null, series: [] }] })],
    ["trop de séries", routine({ exercices: [{ exerciceId: EXO, reposS: null, series: Array(21).fill(serie) }] })],
    ["type de série inconnu", routine({ exercices: [{ exerciceId: EXO, reposS: null, series: [{ ...serie, type: "x" as never }] }] })],
    ["reps décimales", routine({ exercices: [{ exerciceId: EXO, reposS: null, series: [{ ...serie, reps: 1.5 }] }] })],
    ["poids hors bornes", routine({ exercices: [{ exerciceId: EXO, reposS: null, series: [{ ...serie, poids: 9999 }] }] })],
  ])("refuse : %s", (_nom, valeur) => {
    expect(validerRoutine(valeur)).not.toBeNull();
  });

  it("refuse ce qui n'est pas un objet et un identifiant invalide", () => {
    expect(validerRoutine(null)).not.toBeNull();
    expect(validerRoutine([])).not.toBeNull();
    expect(validerRoutine({ ...routine(), id: "abc" })).not.toBeNull();
  });
});

describe("validerNomDossier et modeOuDefaut", () => {
  it("valide le nom d'un dossier", () => {
    expect(validerNomDossier("Hypertrophie")).toBeNull();
    expect(validerNomDossier("  ")).not.toBeNull();
    expect(validerNomDossier("x".repeat(61))).not.toBeNull();
    expect(validerNomDossier(3)).not.toBeNull();
  });

  it("retombe sur poids × reps pour un mode inconnu", () => {
    expect(modeOuDefaut("duree")).toBe("duree");
    expect(modeOuDefaut("autre")).toBe("poids_reps");
  });
});

describe("exerciceDepuisRoutine", () => {
  const detail: RoutineDetail["exercices"][number] = {
    exerciceId: EXO,
    nom: "Développé couché",
    mode: "poids_reps",
    reposS: null,
    reposExerciceS: 120,
    series: [
      { type: "echauffement", poids: 40, reps: 10, duree: null, distance: null },
      { type: "normale", poids: null, reps: 8, duree: null, distance: null },
    ],
  };
  const precedent = [{ poids: 80, reps: 6, duree: null, distance: null }];

  it("crée une série par série cible, avec le type et les cibles de la routine", () => {
    const e = exerciceDepuisRoutine(detail, precedent, compteur());
    expect(e.series.map((s) => [s.type, s.poids, s.reps])).toEqual([
      ["echauffement", 40, 10],
      ["normale", 80, 8],
    ]);
  });

  it("complète les cibles manquantes avec la dernière performance", () => {
    const e = exerciceDepuisRoutine({ ...detail, series: [{ type: "normale", poids: null, reps: null, duree: null, distance: null }] }, precedent, compteur());
    expect(e.series[0]).toMatchObject({ poids: 80, reps: 6 });
  });

  it("choisit le repos : routine, sinon exercice, sinon 90 s", () => {
    expect(exerciceDepuisRoutine({ ...detail, reposS: 45 }, [], compteur()).reposS).toBe(45);
    expect(exerciceDepuisRoutine(detail, [], compteur()).reposS).toBe(120);
    expect(exerciceDepuisRoutine({ ...detail, reposExerciceS: null }, [], compteur()).reposS).toBe(90);
  });

  it("garde une seule série quand la routine n'en définit aucune", () => {
    expect(exerciceDepuisRoutine({ ...detail, series: [] }, [], compteur()).series).toHaveLength(1);
  });
});
