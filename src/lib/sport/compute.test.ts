import { describe, expect, it } from "vitest";
import { filtrerExercices, normaliser, texteRecherche, type ExerciceListe } from "./compute";
import { libelleEquipement, libelleMuscle } from "./libelles";

function exercice(partiel: Partial<ExerciceListe> & Pick<ExerciceListe, "id" | "nom_fr">): ExerciceListe {
  return {
    nom_en: "",
    muscle_principal: "chest",
    equipement: "barbell",
    categorie: "strength",
    niveau: "beginner",
    typeMesure: "poids_reps",
    image: null,
    ...partiel,
  };
}

const EXERCICES = [
  exercice({ id: "a", nom_fr: "Développé couché à la barre", nom_en: "Barbell Bench Press" }),
  exercice({ id: "b", nom_fr: "Écarté à la poulie", nom_en: "Cable Fly", equipement: "cable" }),
  exercice({ id: "c", nom_fr: "Squat", nom_en: "Squat", muscle_principal: "quadriceps", equipement: null }),
];
const SANS_FILTRE = { recherche: "", muscle: null, equipement: null };
const RECHERCHES = new Map(EXERCICES.map((e) => [e.id, texteRecherche(e)]));

describe("normaliser", () => {
  it("retire les accents et la casse", () => {
    expect(normaliser("  Développé   COUCHÉ ")).toBe("developpe couche");
  });
});

describe("filtrerExercices", () => {
  it("renvoie tout sans filtre", () => {
    expect(filtrerExercices(EXERCICES, SANS_FILTRE, RECHERCHES)).toHaveLength(3);
  });

  it("cherche sans tenir compte des accents", () => {
    const ids = filtrerExercices(EXERCICES, { ...SANS_FILTRE, recherche: "ecarte" }, RECHERCHES).map((e) => e.id);
    expect(ids).toEqual(["b"]);
  });

  it("exige tous les mots, dans n'importe quel ordre", () => {
    const ids = filtrerExercices(EXERCICES, { ...SANS_FILTRE, recherche: "barre couche" }, RECHERCHES).map((e) => e.id);
    expect(ids).toEqual(["a"]);
  });

  it("cherche aussi dans le nom anglais", () => {
    const ids = filtrerExercices(EXERCICES, { ...SANS_FILTRE, recherche: "bench" }, RECHERCHES).map((e) => e.id);
    expect(ids).toEqual(["a"]);
  });

  it("filtre par muscle principal", () => {
    const ids = filtrerExercices(EXERCICES, { ...SANS_FILTRE, muscle: "quadriceps" }, RECHERCHES).map((e) => e.id);
    expect(ids).toEqual(["c"]);
  });

  it("traite un équipement absent comme « other »", () => {
    const ids = filtrerExercices(EXERCICES, { ...SANS_FILTRE, equipement: "other" }, RECHERCHES).map((e) => e.id);
    expect(ids).toEqual(["c"]);
  });

  it("combine recherche et filtres", () => {
    const filtres = { recherche: "poulie", muscle: "chest", equipement: "cable" };
    expect(filtrerExercices(EXERCICES, filtres, RECHERCHES).map((e) => e.id)).toEqual(["b"]);
    expect(filtrerExercices(EXERCICES, { ...filtres, muscle: "triceps" }, RECHERCHES)).toEqual([]);
  });
});

describe("libellés", () => {
  it("traduit les slugs connus et garde les inconnus", () => {
    expect(libelleMuscle("lower back")).toBe("Lombaires");
    expect(libelleMuscle("inconnu")).toBe("inconnu");
    expect(libelleEquipement(null)).toBe("Autre");
    expect(libelleEquipement("body only")).toBe("Poids du corps");
  });
});
